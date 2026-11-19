import type { DaySchedule, OptimizeResult, Place } from '../types'
import { type Ctx, finish, initState, partialCost, simulate, step } from './schedule'

/** 순서 탐색 방식:
 *  - 9곳 이하: 가지치기 깊이 우선 탐색으로 최적 순서를 보장
 *  - 그 이상: 최근접 삽입 + 2-opt 개선 (최적 보장 없음)
 *  하드 조건(휴무·영업시간·예약·고정 시각·귀가 시각)을 어기는 순서는 후보에서 제외한다. */
export function optimizeDay(c: Ctx, ids: string[]): OptimizeResult {
  if (ids.length === 0) {
    const schedule = simulate(c, [])
    return { order: [], schedule, feasible: schedule.feasible, method: 'none' }
  }
  return ids.length <= c.defaults.exactSearchMaxStops ? exactSearch(c, ids) : heuristicSearch(c, ids)
}

function exactSearch(c: Ctx, ids: string[]): OptimizeResult {
  const places = ids.map((id) => {
    const p = c.places.get(id)
    if (!p) throw new Error(`장소를 찾을 수 없어요: ${id}`)
    return p
  })
  const n = places.length
  const used = new Array<boolean>(n).fill(false)
  const order: string[] = []
  let best: { cost: number; order: string[]; schedule: DaySchedule } | null = null

  const dfs = (s: ReturnType<typeof initState>) => {
    if (best && partialCost(s) >= best.cost) return
    if (order.length === n) {
      const schedule = finish(s, c)
      if (schedule.feasible && (!best || schedule.cost < best.cost)) {
        best = { cost: schedule.cost, order: [...order], schedule }
      }
      return
    }
    for (let i = 0; i < n; i++) {
      if (used[i]) continue
      const next = step(s, places[i], c, true)
      if (!next) continue
      used[i] = true
      order.push(places[i].id)
      dfs(next)
      order.pop()
      used[i] = false
    }
  }
  dfs(initState(c))

  const found = best as { cost: number; order: string[]; schedule: DaySchedule } | null
  if (found) return { order: found.order, schedule: found.schedule, feasible: true, method: 'exact' }

  // 규칙을 모두 지키는 순서가 없음: 가까운 순서로 두고 문제를 경고로 보여준다
  const fallback = nearestOrder(c, places)
  const schedule = simulate(c, fallback)
  return { order: fallback, schedule, feasible: false, method: 'exact' }
}

function nearestOrder(c: Ctx, places: Place[]): string[] {
  const fw = c.day.freeWindow!
  let cur = c.places.get(fw.startPlaceId)!
  const left = [...places]
  const out: string[] = []
  while (left.length) {
    let bi = 0
    let bm = Infinity
    left.forEach((p, i) => {
      const m = c.travel(cur, p).minutes
      if (m < bm) {
        bm = m
        bi = i
      }
    })
    cur = left.splice(bi, 1)[0]
    out.push(cur.id)
  }
  return out
}

function heuristicSearch(c: Ctx, ids: string[]): OptimizeResult {
  // 1) 최근접 삽입: 하나씩, 가장 비용이 덜 늘어나는 자리에 넣는다
  let order: string[] = []
  for (const id of ids) {
    let bestPos = order.length
    let bestScore = Infinity
    for (let pos = 0; pos <= order.length; pos++) {
      const trial = [...order.slice(0, pos), id, ...order.slice(pos)]
      const sch = simulate(c, trial)
      // 하드 조건 위반은 큰 벌점으로 밀어낸다
      const score = sch.cost + (sch.feasible ? 0 : 100000)
      if (score < bestScore) {
        bestScore = score
        bestPos = pos
      }
    }
    order = [...order.slice(0, bestPos), id, ...order.slice(bestPos)]
  }

  // 2) 2-opt: 구간을 뒤집어 비용이 줄면 채택 (최대 5바퀴)
  let current = simulate(c, order)
  for (let pass = 0; pass < 5; pass++) {
    let improved = false
    for (let i = 0; i < order.length - 1; i++) {
      for (let j = i + 1; j < order.length; j++) {
        const trial = [...order.slice(0, i), ...order.slice(i, j + 1).reverse(), ...order.slice(j + 1)]
        const sch = simulate(c, trial)
        const better =
          (sch.feasible && !current.feasible) || (sch.feasible === current.feasible && sch.cost < current.cost - 1e-9)
        if (better) {
          order = trial
          current = sch
          improved = true
        }
      }
    }
    if (!improved) break
  }
  return { order, schedule: current, feasible: current.feasible, method: 'heuristic' }
}
