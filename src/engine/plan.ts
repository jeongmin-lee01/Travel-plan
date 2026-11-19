import type {
  CheckedEntry,
  DateStr,
  DayPlan,
  DayRank,
  DaySchedule,
  DropSuggestion,
  EngineData,
  Flag,
  PlanDiff,
  PlanState,
  ToggleResult,
} from '../types'
import { optimizeDay } from './optimize'
import { makeCtx, placeIndex, simulate } from './schedule'
import { makeTravel, type TravelFn } from './travel'

/**
 * 체크리스트 모델: 상태(PlanState)는 "어떤 후보를 체크했는가"뿐이다.
 * 동선은 상태에서 매번 계산해 내므로, 상태(JSON)를 저장·내보내기만 하면 어디서든 같은 동선이 나온다.
 */
export const emptyState = (): PlanState => ({ checked: {}, manualOrder: {} })

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

export const idsOnDay = (state: PlanState, date: DateStr): string[] =>
  Object.entries(state.checked)
    .filter(([, e]) => e.day === date)
    .map(([id]) => id)

const EMPTY_SCHEDULE = (date: DateStr): DaySchedule => ({
  date,
  stops: [],
  endArrive: 0,
  totals: { travelMin: 0, waitMin: 0, fareYen: 0, steps: 0 },
  flags: [],
  feasible: true,
  cost: 0,
})

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
  if (!day.freeWindow) return { date, order: [], manual: false, schedule: EMPTY_SCHEDULE(date) }
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

const withEntry = (state: PlanState, id: string, entry: CheckedEntry): PlanState => ({
  ...state,
  checked: { ...state.checked, [id]: entry },
})

function withoutEntry(state: PlanState, id: string): PlanState {
  const entry = state.checked[id]
  const checked = { ...state.checked }
  delete checked[id]
  const manualOrder = { ...state.manualOrder }
  if (entry && manualOrder[entry.day]) manualOrder[entry.day] = manualOrder[entry.day].filter((x) => x !== id)
  return { checked, manualOrder }
}

type Extra = { stayMinutes?: number; pinTime?: number }

/** 후보를 각 날에 넣었을 때의 비용·가능 여부. 앞쪽일수록 잘 맞는 날 */
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
    const entry: CheckedEntry = { day: day.date, ...(opts.stayMinutes !== undefined && { stayMinutes: opts.stayMinutes }), ...(opts.pinTime !== undefined && { pinTime: opts.pinTime }) }
    const after = computeDay(data, withEntry(state, placeId, entry), day.date)
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

/** 이 후보를 넣으려면 무엇을 빼야 하는지 */
function dropSuggestions(data: EngineData, state: PlanState, placeId: string, date: DateStr, extra: Extra): DropSuggestion[] {
  const out: DropSuggestion[] = []
  for (const id of idsOnDay(state, date)) {
    if (state.checked[id].pinTime !== undefined) continue
    const trimmed = withoutEntry(state, id)
    const entry: CheckedEntry = { day: date, ...extra }
    const after = computeDay(data, withEntry(trimmed, placeId, entry), date)
    out.push({ dropPlaceId: id, makesFeasible: after.schedule.feasible })
  }
  return out.sort((a, b) => Number(b.makesFeasible) - Number(a.makesFeasible))
}

/**
 * 체크리스트에서 후보를 체크/해제한다.
 * - 체크: 그 시점에 가장 잘 맞는 날(opts.day로 지정 가능)에 바로 넣고 순서를 다시 계산한다.
 *   넣을 수 없으면 state는 그대로 두고 action='blocked'와 이유·제안을 돌려준다.
 * - 해제: 동선에서 빼고(삭제 아님, 후보로 복귀) 순서를 다시 계산한다.
 */
export function toggle(
  data: EngineData,
  state: PlanState,
  placeId: string,
  opts: { day?: DateStr } & Extra = {},
): ToggleResult {
  const p = placeIndex(data).get(placeId)
  if (!p) throw new Error(`장소를 찾을 수 없어요: ${placeId}`)
  const blocked = (reason: string, rankedDays: DayRank[] = [], drops: DropSuggestion[] = [], flags: Flag[] = []): ToggleResult => ({
    action: 'blocked', placeId, state, flags, rankedDays, dropSuggestions: drops, reason,
  })

  const existing = state.checked[placeId]
  if (existing) {
    const before = computeDay(data, state, existing.day)
    const next = withoutEntry(state, placeId)
    const after = computeDay(data, next, existing.day)
    return {
      action: 'removed', placeId, day: existing.day, state: next,
      before: before.schedule, after: after.schedule, diff: diffOf(before, after),
      flags: [...after.schedule.flags, ...chainFlags(data, next, existing.day)], rankedDays: [], dropSuggestions: [],
    }
  }

  if (p.type !== 'candidate') return blocked('고정 장소는 체크리스트에 없어요')
  if (p.lat === null || p.lng === null) {
    return blocked('좌표가 없어서 동선에 넣을 수 없어요. 구글맵에서 위치를 확인해 입력해 주세요', [], [], [
      { code: 'no-coords', severity: 'block', placeId, message: `${p.name.ko}: 좌표 필요` },
    ])
  }

  const extra: Extra = { stayMinutes: opts.stayMinutes, pinTime: opts.pinTime }
  const ranked = rankDays(data, state, placeId, { day: opts.day, ...extra })
  const chosen = ranked.find((r) => r.feasible)
  if (!chosen) {
    const target = ranked.find((r) => !r.unavailable)
    if (!target) return blocked(opts.day ? `${opts.day}에는 갈 수 없어요 (휴무 또는 지역이 맞지 않아요)` : '11/23~26 중 갈 수 있는 날이 없어요', ranked)
    return blocked(
      `넣으면 일정이 안 맞아요: ${target.reason ?? '시간이 부족해요'}`,
      ranked,
      dropSuggestions(data, state, placeId, target.day, extra),
    )
  }

  const date = chosen.day
  const before = computeDay(data, state, date)
  const entry: CheckedEntry = { day: date, ...(extra.stayMinutes !== undefined && { stayMinutes: extra.stayMinutes }), ...(extra.pinTime !== undefined && { pinTime: extra.pinTime }) }
  let next = withEntry(state, placeId, entry)

  // 손으로 정한 순서가 있으면 그 순서를 지키고, 새 장소는 가장 덜 돌아가는 자리에 끼워 넣는다
  const manual = state.manualOrder[date]
  if (manual) {
    const day = dayConfig(data, date)
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
    rankedDays: ranked, dropSuggestions: [],
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

/** 체류시간·고정 시각 수정 */
export function updateEntry(state: PlanState, placeId: string, patch: Partial<Omit<CheckedEntry, 'day'>>): PlanState {
  const e = state.checked[placeId]
  if (!e) return state
  return withEntry(state, placeId, { ...e, ...patch })
}
