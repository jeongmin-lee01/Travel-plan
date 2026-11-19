import type {
  CheckedEntry,
  DayConfig,
  DaySchedule,
  Defaults,
  EngineData,
  Flag,
  Minutes,
  Place,
  StopPlan,
} from '../types'
import type { TravelFn } from './travel'
import { parseHours, toHHMM, toMin } from './time'

/** 소프트 조건 벌점(분 환산) */
export const OVERFLOW_PENALTY_PER_MIN = 2
export const STEPS_PENALTY_PER_STEP = 1 / 60

export interface Ctx {
  day: DayConfig
  places: Map<string, Place>
  travel: TravelFn
  defaults: Defaults
  /** 사용자가 고친 체류시간 */
  stay: Record<string, number>
  /** 시작 시각을 고정한 장소(고정 핀·예약) */
  pin: Record<string, Minutes>
}

const indexCache = new WeakMap<EngineData, Map<string, Place>>()

export function placeIndex(data: EngineData): Map<string, Place> {
  let idx = indexCache.get(data)
  if (!idx) {
    idx = new Map(data.places.map((p) => [p.id, p]))
    indexCache.set(data, idx)
  }
  return idx
}

export function makeCtx(
  data: EngineData,
  day: DayConfig,
  entries: Record<string, CheckedEntry>,
  travel: TravelFn,
): Ctx {
  const stay: Record<string, number> = {}
  const pin: Record<string, Minutes> = {}
  for (const [id, e] of Object.entries(entries)) {
    if (e.day !== day.date) continue
    if (e.stayMinutes !== undefined) stay[id] = e.stayMinutes
    if (e.pinTime !== undefined) pin[id] = e.pinTime
  }
  return { day, places: placeIndex(data), travel, defaults: data.itinerary.defaults, stay, pin }
}

export interface SimState {
  t: Minutes
  cur: Place
  stops: StopPlan[]
  flags: Flag[]
  travelMin: number
  waitMin: number
  fare: number
  steps: number
  penalty: number
}

const name = (p: Place) => p.name.ko
const isBlock = (f: Flag) => f.severity === 'block'

export const stayOf = (c: Ctx, p: Place): number => c.stay[p.id] ?? p.stayMinutes.value

export function initState(c: Ctx): SimState {
  const fw = c.day.freeWindow
  if (!fw) throw new Error(`${c.day.label}은 후보를 넣을 수 있는 빈 시간이 없어요`)
  const cur = c.places.get(fw.startPlaceId)
  if (!cur) throw new Error(`장소를 찾을 수 없어요: ${fw.startPlaceId}`)
  return { t: toMin(fw.start), cur, stops: [], flags: [], travelMin: 0, waitMin: 0, fare: 0, steps: 0, penalty: 0 }
}

/**
 * 장소 하나를 다음 방문지로 붙여 본다.
 * strict=true면 하드 조건(휴무·영업시간·예약·고정 시각)을 어기는 순간 null을 돌려준다(탐색 가지치기용).
 */
export function step(s: SimState, p: Place, c: Ctx, strict: boolean): SimState | null {
  const date = c.day.date
  const flags: Flag[] = []

  if (p.closedDates?.includes(date) || (p.type === 'candidate' && !p.availableDates.includes(date))) {
    flags.push({ code: 'closed-day', severity: 'block', placeId: p.id, message: `${name(p)}: 이 날은 갈 수 없어요 (휴무 또는 지역이 맞지 않아요)` })
  }

  const leg = c.travel(s.cur, p)
  const buffer = leg.minutes === 0 ? 0 : leg.mode === 'walk' ? c.defaults.bufferWalkMin : c.defaults.bufferTransitMin
  const arrive = s.t + leg.minutes + buffer
  let start = arrive
  let penalty = 0

  const hrs = parseHours(p, date)
  if (!hrs || p.needsCheck.includes('hours')) {
    flags.push({ code: 'hours-unverified', severity: 'info', placeId: p.id, message: `${name(p)}: 영업시간 확인 필요` })
  }
  if (hrs && arrive < hrs.open) start = hrs.open

  const pin = c.pin[p.id] ?? (p.myReservation.time ? toMin(p.myReservation.time) : undefined)
  if (pin !== undefined) {
    if (arrive > pin + 5) {
      flags.push({ code: 'reservation-late', severity: 'block', placeId: p.id, message: `${name(p)}: ${toHHMM(pin)} 고정 시각에 맞출 수 없어요 (도착 ${toHHMM(arrive)})` })
    } else {
      start = Math.max(start, pin)
    }
  } else if (['필수', '정리권·추첨'].includes(p.reservation.kind)) {
    flags.push({ code: 'reservation-missing', severity: 'warn', placeId: p.id, message: `${name(p)}: ${p.reservation.kind} — 내 예약 정보가 비어 있어요` })
  }

  const stay = stayOf(c, p)
  if (hrs) {
    const explicitLast = p.lastEntry ? toMin(p.lastEntry) : undefined
    const lastEntry = explicitLast ?? hrs.close - 15
    if (start > lastEntry) {
      flags.push({
        code: explicitLast !== undefined ? 'after-last-entry' : 'outside-hours',
        severity: 'block',
        placeId: p.id,
        message: `${name(p)}: ${toHHMM(start)}에는 입장할 수 없어요 (${explicitLast !== undefined ? '마지막 입장' : '폐점'} ${toHHMM(explicitLast ?? hrs.close)})`,
      })
    } else if (start + stay > hrs.close) {
      const over = start + stay - hrs.close
      penalty += over * OVERFLOW_PENALTY_PER_MIN
      flags.push({ code: 'outside-hours', severity: 'warn', placeId: p.id, message: `${name(p)}: 폐점(${toHHMM(hrs.close)}) 전에 ${over}분 일찍 나와야 해요` })
    }
  }

  if (strict && flags.some(isBlock)) return null

  const end = start + stay
  const stop: StopPlan = { kind: 'place', placeId: p.id, arrive, start, end, waitMin: start - arrive, travel: leg }
  return {
    t: end,
    cur: p,
    stops: [...s.stops, stop],
    flags: [...s.flags, ...flags],
    travelMin: s.travelMin + leg.minutes,
    waitMin: s.waitMin + (start - arrive),
    fare: s.fare + leg.fareYen,
    steps: s.steps + leg.steps + stay * c.defaults.stepsPerStoreMin,
    penalty: s.penalty + penalty,
  }
}

export function partialCost(s: SimState): number {
  return s.travelMin + s.waitMin + s.penalty
}

/** 마지막 장소에서 귀가(또는 공항 출발지)까지 이동해 하루를 마무리한다 */
export function finish(s: SimState, c: Ctx): DaySchedule {
  const fw = c.day.freeWindow!
  const home = c.places.get(fw.endPlaceId)!
  const leg = c.travel(s.cur, home)
  const buffer = leg.minutes === 0 ? 0 : leg.mode === 'walk' ? c.defaults.bufferWalkMin : c.defaults.bufferTransitMin
  const endArrive = s.t + leg.minutes + buffer
  const flags = [...s.flags]
  let penalty = s.penalty

  const returnBy = toMin(fw.returnBy)
  if (endArrive > returnBy) {
    const airport = fw.deadlineKind === 'airport'
    flags.push({
      code: airport ? 'airport-deadline' : 'day-end-late',
      severity: 'block',
      message: airport
        ? `숙소 복귀 ${toHHMM(endArrive)}: 공항 도착 16:05를 맞추려면 ${toHHMM(returnBy)}까지 돌아와야 해요`
        : `숙소 복귀 ${toHHMM(endArrive)}: 귀가 목표 ${toHHMM(returnBy)}를 넘어요`,
    })
  }

  const steps = s.steps + leg.steps
  if (steps > c.defaults.stepsTarget) {
    penalty += (steps - c.defaults.stepsTarget) * STEPS_PENALTY_PER_STEP
    flags.push({ code: 'steps-over', severity: 'warn', message: `예상 ${steps.toLocaleString('ko-KR')}보: 목표 ${c.defaults.stepsTarget.toLocaleString('ko-KR')}보를 넘어요` })
  }

  const travelMin = s.travelMin + leg.minutes
  return {
    date: c.day.date,
    stops: s.stops,
    endArrive,
    returnTravel: leg,
    totals: { travelMin, waitMin: s.waitMin, fareYen: s.fare + leg.fareYen, steps },
    flags,
    feasible: !flags.some(isBlock),
    cost: travelMin + s.waitMin + penalty,
  }
}

/** 순서를 받아 시각을 시뮬레이션한다. 규칙을 어겨도 멈추지 않고 경고(flag)로 남긴다 */
export function simulate(c: Ctx, order: string[]): DaySchedule {
  let s = initState(c)
  for (const id of order) {
    const p = c.places.get(id)
    if (!p) throw new Error(`장소를 찾을 수 없어요: ${id}`)
    s = step(s, p, c, false)!
  }
  return finish(s, c)
}
