import type {
  CheckedEntry,
  DateStr,
  DayPlan,
  DayRank,
  DaySchedule,
  EngineData,
  Flag,
  Place,
  PlanDiff,
  PlanState,
  ToggleResult,
} from '../types'
import { optimizeDay } from './optimize'
import { fixedLegs, makeCtx, placeIndex, simulate } from './schedule'
import { makeTravel, type TravelFn } from './travel'

/**
 * 체크리스트 모델: 상태(PlanState)는 "어떤 후보를 어느 날에 체크했는가"뿐이다.
 * 같은 후보를 여러 날에 체크할 수 있고, 날짜별로 따로 체크·해제한다.
 * 동선은 상태에서 매번 계산해 내므로, 상태(JSON)를 저장·내보내기만 하면 어디서든 같은 동선이 나온다.
 */
export const emptyState = (): PlanState => ({ checked: {}, manualOrder: {} })

/** 체크 항목의 키: 후보 + 날짜 */
export const entryKey = (placeId: string, date: DateStr): string => `${placeId}@${date}`

const travelCache = new WeakMap<EngineData, TravelFn>()
function travelFor(data: EngineData): TravelFn {
  let t = travelCache.get(data)
  if (!t) {
    t = makeTravel(data)
    travelCache.set(data, t)
  }
  return t
}

function dayConfig(data: EngineData, date: DateStr) {
  const day = data.itinerary.days.find((d) => d.date === date)
  if (!day) throw new Error(`여행 기간이 아닌 날짜예요: ${date}`)
  return day
}

/** 그날 체크된 후보들(체크한 순서) */
export const idsOnDay = (state: PlanState, date: DateStr): string[] =>
  Object.values(state.checked)
    .filter((e) => e.day === date)
    .map((e) => e.placeId)

/** 이 후보를 체크해 둔 날짜들 */
export const daysOf = (state: PlanState, placeId: string): DateStr[] =>
  Object.values(state.checked)
    .filter((e) => e.placeId === placeId)
    .map((e) => e.day)

/** 후보를 넣을 수 없는 날(하루 종일 일정)의 일정: 고정 이동(숙소 ↔ USJ)만 합계에 들어간다 */
const fixedOnlySchedule = (data: EngineData, date: DateStr): DaySchedule => {
  const legs = fixedLegs(dayConfig(data, date), placeIndex(data), travelFor(data))
  const minutes = legs.reduce((a, l) => a + l.minutes, 0)
  const fare = legs.reduce((a, l) => a + l.fareYen, 0)
  return {
    date,
    stops: [],
    endArrive: 0,
    totals: {
      travelMin: minutes,
      waitMin: 0,
      fareYen: fare,
      steps: legs.reduce((a, l) => a + l.steps, 0),
      bufferMin: 0,
      fixedLegMin: minutes,
      fixedLegFareYen: fare,
    },
    flags: [],
    feasible: true,
    cost: 0,
  }
}

// 상태 객체는 바뀔 때마다 새로 만들어지므로(불변), 같은 상태·날짜의 계산 결과는 재사용한다
const dayCache = new WeakMap<EngineData, WeakMap<PlanState, Map<DateStr, DayPlan>>>()

/** 그날 동선 계산. 손으로 바꾼 순서가 있으면 그 순서를 지키고 시각·경고만 다시 계산 */
export function computeDay(data: EngineData, state: PlanState, date: DateStr): DayPlan {
  let byState = dayCache.get(data)
  if (!byState) dayCache.set(data, (byState = new WeakMap()))
  let byDate = byState.get(state)
  if (!byDate) byState.set(state, (byDate = new Map()))
  let plan = byDate.get(date)
  if (!plan) byDate.set(date, (plan = computeDayUncached(data, state, date)))
  return plan
}

function computeDayUncached(data: EngineData, state: PlanState, date: DateStr): DayPlan {
  const day = dayConfig(data, date)
  if (!day.freeWindow) return { date, order: [], manual: false, schedule: fixedOnlySchedule(data, date) }
  const c = makeCtx(data, day, state.checked, travelFor(data))
  const ids = idsOnDay(state, date)
  const manual = state.manualOrder[date]
  if (manual) {
    const order = [...manual.filter((id) => ids.includes(id)), ...ids.filter((id) => !manual.includes(id))]
    return { date, order, manual: true, schedule: simulate(c, order) }
  }
  const r = optimizeDay(c, ids)
  return { date, order: r.order, manual: false, schedule: r.schedule }
}

export const computePlan = (data: EngineData, state: PlanState): DayPlan[] =>
  data.itinerary.days.map((d) => computeDay(data, state, d.date))

function diffOf(before: DayPlan, after: DayPlan): PlanDiff {
  const sameOrder = (a: string[], b: string[]) => {
    // 새로 들어가거나 빠진 장소를 뺀 나머지끼리 순서가 같은가
    const common = a.filter((x) => b.includes(x))
    const commonB = b.filter((x) => a.includes(x))
    return common.join() === commonB.join()
  }
  return {
    orderBefore: before.order,
    orderAfter: after.order,
    orderChanged: !sameOrder(before.order, after.order),
    addedTravelMin: after.schedule.totals.travelMin - before.schedule.totals.travelMin,
    addedWaitMin: after.schedule.totals.waitMin - before.schedule.totals.waitMin,
    addedSteps: after.schedule.totals.steps - before.schedule.totals.steps,
    addedFareYen: after.schedule.totals.fareYen - before.schedule.totals.fareYen,
    endArriveBefore: before.schedule.endArrive,
    endArriveAfter: after.schedule.endArrive,
  }
}

const withEntry = (state: PlanState, entry: CheckedEntry): PlanState => ({
  ...state,
  checked: { ...state.checked, [entryKey(entry.placeId, entry.day)]: entry },
})

/** 한 날의 체크를 뺀다 */
function withoutEntry(state: PlanState, placeId: string, date: DateStr): PlanState {
  const checked = { ...state.checked }
  delete checked[entryKey(placeId, date)]
  const manualOrder = { ...state.manualOrder }
  if (manualOrder[date]) manualOrder[date] = manualOrder[date].filter((x) => x !== placeId)
  return { checked, manualOrder }
}

/** 이 후보의 체크를 모든 날에서 뺀다(후보 목록에서 제거할 때) */
export function withoutPlace(state: PlanState, placeId: string): PlanState {
  let next = state
  for (const d of daysOf(state, placeId)) next = withoutEntry(next, placeId, d)
  return next
}

type Extra = { stayMinutes?: number; pinTime?: number }

/** 후보를 각 날에 넣었을 때의 비용·가능 여부. 앞쪽일수록 잘 맞는 날(추천용) */
export function rankDays(
  data: EngineData,
  state: PlanState,
  placeId: string,
  opts: { day?: DateStr } & Extra = {},
): DayRank[] {
  const p = placeIndex(data).get(placeId)
  if (!p) throw new Error(`장소를 찾을 수 없어요: ${placeId}`)
  const out: DayRank[] = []
  for (const day of data.itinerary.days) {
    if (!day.freeWindow || (opts.day && day.date !== opts.day)) continue
    if (!p.availableDates.includes(day.date) || p.closedDates?.includes(day.date)) {
      out.push({ day: day.date, feasible: false, unavailable: true, addedCost: Infinity, reason: '휴무 또는 지역이 맞지 않아요' })
      continue
    }
    const before = computeDay(data, state, day.date)
    const entry: CheckedEntry = {
      placeId,
      day: day.date,
      ...(opts.stayMinutes !== undefined && { stayMinutes: opts.stayMinutes }),
      ...(opts.pinTime !== undefined && { pinTime: opts.pinTime }),
    }
    const after = computeDay(data, withEntry(state, entry), day.date)
    const feasible = after.schedule.feasible
    out.push({
      day: day.date,
      feasible,
      addedCost: feasible ? after.schedule.cost - before.schedule.cost : Infinity,
      reason: feasible ? undefined : after.schedule.flags.find((f) => f.severity === 'block')?.message,
    })
  }
  return out.sort((a, b) => Number(b.feasible) - Number(a.feasible) || a.addedCost - b.addedCost)
}

function chainFlags(data: EngineData, state: PlanState, date: DateStr): Flag[] {
  const idx = placeIndex(data)
  const groups = new Map<string, string[]>()
  for (const id of idsOnDay(state, date)) {
    const g = idx.get(id)?.chainGroup
    if (g) groups.set(g, [...(groups.get(g) ?? []), id])
  }
  const flags: Flag[] = []
  for (const [g, ids] of groups) {
    if (ids.length >= 2) {
      flags.push({
        code: 'chain-duplicate',
        severity: 'info',
        message: `같은 ${g.toUpperCase()} 매장이 이 날 ${ids.length}곳이에요. 하나만 가도 될까요?`,
      })
    }
  }
  return flags
}

const SKIP_FLAGS = new Set(['closed-day', 'reservation-missing', 'hours-unverified', 'chain-duplicate'])

/**
 * 체크할 때 알려 줄 주의 문구. 체크를 막지는 않는다.
 * 예) "Day 1에 이미 추가된 장소예요", "교토 지역이에요 · Day 2에 가는 걸 추천해요"
 */
function cautionsFor(data: EngineData, p: Place, date: DateStr, state: PlanState, after: DayPlan, otherDays: DateStr[]): string[] {
  const label = (d: DateStr) => data.itinerary.days.find((x) => x.date === d)?.label ?? d
  const day = dayConfig(data, date)
  const out: string[] = []

  if (otherDays.length) out.push(`${otherDays.map(label).join('·')}에 이미 추가된 장소예요`)

  const recommend = p.availableDates.length
    ? ` · ${p.availableDates.map(label).join('·')}에 가는 걸 추천해요`
    : ''
  const placeCity = p.area.split('-')[0]
  if (p.closedDates?.includes(date)) {
    out.push(`이 날은 휴무일이에요${recommend}`)
  } else if ((placeCity === '오사카' || placeCity === '교토') && placeCity !== day.city) {
    out.push(`${placeCity} 지역이에요${recommend}`)
  } else if (!p.availableDates.includes(date)) {
    out.push(`이 날은 갈 수 없는 날로 조사됐어요${recommend}`)
  }

  // 이 장소 때문에 생긴 경고와 하루 전체의 규칙 위반(공항·귀가 시각 등)
  for (const f of after.schedule.flags) {
    if (SKIP_FLAGS.has(f.code) || f.severity === 'info') continue
    if (f.placeId && f.placeId !== p.id) continue
    out.push(f.message)
  }
  for (const f of chainFlags(data, state, date)) out.push(f.message)
  return [...new Set(out)]
}

/**
 * 체크리스트에서 후보를 그 날짜에 체크/해제한다.
 * - 체크: 그 날 동선에 넣고 순서를 다시 계산한다. 막지 않고, 주의할 점은 cautions로 알려 준다.
 *   (같은 후보를 여러 날에 체크할 수 있다.)
 * - 해제: 그 날 동선에서만 뺀다(삭제 아님, 후보로 복귀).
 * 위치가 없어 계산할 수 없는 후보와 하루 종일 일정(USJ)인 날만 막는다.
 */
export function toggle(
  data: EngineData,
  state: PlanState,
  placeId: string,
  opts: { day: DateStr } & Extra,
): ToggleResult {
  const p = placeIndex(data).get(placeId)
  if (!p) throw new Error(`장소를 찾을 수 없어요: ${placeId}`)
  const date = opts.day
  const blocked = (reason: string, flags: Flag[] = []): ToggleResult => ({
    action: 'blocked', placeId, day: date, state, flags, cautions: [], reason,
  })

  const key = entryKey(placeId, date)
  if (state.checked[key]) {
    const before = computeDay(data, state, date)
    const next = withoutEntry(state, placeId, date)
    const after = computeDay(data, next, date)
    return {
      action: 'removed', placeId, day: date, state: next,
      before: before.schedule, after: after.schedule, diff: diffOf(before, after),
      flags: [...after.schedule.flags, ...chainFlags(data, next, date)], cautions: [],
    }
  }

  if (p.type !== 'candidate') return blocked('고정 장소는 체크리스트에 없어요')
  if (p.lat === null || p.lng === null) {
    return blocked('좌표가 없어서 동선에 넣을 수 없어요. 구글맵에서 위치를 확인해 입력해 주세요', [
      { code: 'no-coords', severity: 'block', placeId, message: `${p.name.ko}: 좌표 필요` },
    ])
  }
  const day = dayConfig(data, date)
  if (!day.freeWindow) return blocked(`${day.label}은 하루 종일 일정이라 후보를 넣을 수 없어요`)

  const otherDays = daysOf(state, placeId).filter((d) => d !== date)
  const before = computeDay(data, state, date)
  const entry: CheckedEntry = {
    placeId,
    day: date,
    ...(opts.stayMinutes !== undefined && { stayMinutes: opts.stayMinutes }),
    ...(opts.pinTime !== undefined && { pinTime: opts.pinTime }),
  }
  let next = withEntry(state, entry)

  // 손으로 정한 순서가 있으면 그 순서를 지키고, 새 장소는 가장 덜 돌아가는 자리에 끼워 넣는다
  if (state.manualOrder[date]) {
    const c = makeCtx(data, day, next.checked, travelFor(data))
    const base = before.order
    let bestPos = base.length
    let bestScore = Infinity
    for (let pos = 0; pos <= base.length; pos++) {
      const trial = [...base.slice(0, pos), placeId, ...base.slice(pos)]
      const s = simulate(c, trial)
      const score = s.cost + (s.feasible ? 0 : 100000)
      if (score < bestScore) {
        bestScore = score
        bestPos = pos
      }
    }
    next = { ...next, manualOrder: { ...next.manualOrder, [date]: [...base.slice(0, bestPos), placeId, ...base.slice(bestPos)] } }
  }

  const after = computeDay(data, next, date)
  return {
    action: 'added', placeId, day: date, state: next,
    before: before.schedule, after: after.schedule, diff: diffOf(before, after),
    flags: [...after.schedule.flags, ...chainFlags(data, next, date)],
    cautions: cautionsFor(data, p, date, next, after, otherDays),
  }
}

/** 손으로 순서를 바꾼 경우: 자동 최적화보다 내 순서를 우선한다 */
export function applyOrder(state: PlanState, date: DateStr, order: string[]): PlanState {
  return { ...state, manualOrder: { ...state.manualOrder, [date]: order } }
}

/** "다시 최적화": 손으로 바꾼 순서를 버리고 자동 순서로 되돌린다 */
export function reoptimize(state: PlanState, date: DateStr): PlanState {
  const manualOrder = { ...state.manualOrder }
  delete manualOrder[date]
  return { ...state, manualOrder }
}

/** 그 날 체류시간·고정 시각 수정 */
export function updateEntry(state: PlanState, placeId: string, date: DateStr, patch: Partial<Pick<CheckedEntry, 'stayMinutes' | 'pinTime'>>): PlanState {
  const e = state.checked[entryKey(placeId, date)]
  if (!e) return state
  return withEntry(state, { ...e, ...patch })
}
