import { describe, expect, it } from 'vitest'
import { computeDay, defaultData, emptyState, makeCtx, makeTravel, optimizeDay, simulate, toggle, toHHMM } from './index'
import type { CheckedEntry, DateStr, EngineData, PlanState } from '../types'

/** 동선 효율 검증: 엔진이 고른 순서가 정말 최선인지, 모든 순서를 직접 시험해 비교한다 */

const D1 = '2026-11-23'
const D2 = '2026-11-24'
const D4 = '2026-11-26'

function mulberry32(seed: number) {
  return () => {
    seed |= 0
    seed = (seed + 0x6d2b79f5) | 0
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function permutations<T>(items: T[]): T[][] {
  if (items.length <= 1) return [items]
  return items.flatMap((x, i) => permutations([...items.slice(0, i), ...items.slice(i + 1)]).map((rest) => [x, ...rest]))
}

function ctxFor(data: EngineData, date: DateStr, ids: string[]) {
  const day = data.itinerary.days.find((d) => d.date === date)!
  const entries: Record<string, CheckedEntry> = Object.fromEntries(ids.map((id) => [`${id}@${date}`, { placeId: id, day: date }]))
  return makeCtx(data, day, entries, makeTravel(data))
}

/** 모든 순서를 직접 시험한 최소 비용(조건을 모두 지키는 순서만) */
function bruteBest(data: EngineData, date: DateStr, ids: string[]) {
  const ctx = ctxFor(data, date, ids)
  let best = Infinity
  for (const perm of permutations(ids)) {
    const s = simulate(ctx, perm)
    if (s.feasible && s.cost < best) best = s.cost
  }
  return best
}

const kyotoIds = defaultData.places
  .filter((p) => p.type === 'candidate' && p.lat !== null && p.availableDates.includes(D2))
  .map((p) => p.id)
const osakaIds = defaultData.places
  .filter((p) => p.type === 'candidate' && p.lat !== null && p.availableDates.includes(D1))
  .map((p) => p.id)

describe('효율 검증 1: 엔진이 고른 순서가 모든 순서 중 최선인가', () => {
  it('교토 후보 무작위 조합 60개(2~7곳): 엔진 비용 = 전수 시험 최소 비용', () => {
    const rnd = mulberry32(20261120)
    let checked = 0
    let infeasibleAll = 0
    const mismatches: string[] = []
    for (let t = 0; t < 60; t++) {
      const n = 2 + Math.floor(rnd() * 6)
      const ids = [...kyotoIds].sort(() => rnd() - 0.5).slice(0, n)
      const best = bruteBest(defaultData, D2, ids)
      const r = optimizeDay(ctxFor(defaultData, D2, ids), ids)
      if (best === Infinity) {
        infeasibleAll++
        expect(r.feasible).toBe(false)
        continue
      }
      checked++
      if (!r.feasible || Math.abs(r.schedule.cost - best) > 1e-9) mismatches.push(`${ids.join(',')}: 엔진 ${r.schedule.cost} vs 최선 ${best}`)
    }
    console.log(`\n=== 효율 검증 1 ===\n    비교 ${checked}건, 모두 불가능한 조합 ${infeasibleAll}건, 불일치 ${mismatches.length}건`)
    if (mismatches.length) console.log('    ' + mismatches.join('\n    '))
    expect(mismatches).toEqual([])
  })

  it('오사카 후보 조합(Day 1, Day 4)도 전수 시험과 일치', () => {
    for (const date of [D1, D4]) {
      const ids = osakaIds
      const best = bruteBest(defaultData, date, ids)
      const r = optimizeDay(ctxFor(defaultData, date, ids), ids)
      console.log(`    ${date}: 엔진 ${r.feasible ? r.schedule.cost.toFixed(1) : '불가'} / 최선 ${best === Infinity ? '불가' : best.toFixed(1)}`)
      if (best !== Infinity) expect(r.schedule.cost).toBeCloseTo(best, 9)
      else expect(r.feasible).toBe(false)
    }
  })

  it('휴리스틱(10곳 이상 방식)이 정확 탐색에 얼마나 근접한가 (7곳으로 비교)', () => {
    const forced: EngineData = {
      ...defaultData,
      itinerary: { ...defaultData.itinerary, defaults: { ...defaultData.itinerary.defaults, exactSearchMaxStops: 0 } },
    }
    const rnd = mulberry32(7)
    let worst = 0
    let sumGap = 0
    let n = 0
    for (let t = 0; t < 12; t++) {
      const ids = [...kyotoIds].sort(() => rnd() - 0.5).slice(0, 7)
      const exact = optimizeDay(ctxFor(defaultData, D2, ids), ids)
      const heur = optimizeDay(ctxFor(forced, D2, ids), ids)
      if (!exact.feasible || !heur.feasible) continue
      const gap = (heur.schedule.cost - exact.schedule.cost) / exact.schedule.cost
      worst = Math.max(worst, gap)
      sumGap += gap
      n++
    }
    console.log(`\n=== 휴리스틱 품질(7곳) ===\n    ${n}건 평균 차이 ${((sumGap / n) * 100).toFixed(1)}%, 최대 ${(worst * 100).toFixed(1)}%`)
    expect(n).toBeGreaterThan(0)
  })
})

describe('효율 검증 2: 사용자가 이것저것 추가한 실제 시나리오', () => {
  it('교토 후보 8곳을 체크하는 순서를 바꿔도 같은 최종 동선이 나온다(순서에 의존하지 않음)', () => {
    const picks = ['pokemon-center-kyoto', 'mandarake-kyoto', 'surugaya-teramachi', 'champion-kyoto', 'guf-kyoto', 'yodobashi-kyoto', 'edion-kawaramachi', 'nintendo-kyoto']
    const run = (order: string[]) => {
      let s: PlanState = emptyState()
      for (const id of order) {
        const r = toggle(defaultData, s, id, { day: D2 })
        if (r.action === 'added') s = r.state
      }
      return computeDay(defaultData, s, D2)
    }
    const a = run(picks)
    const b = run([...picks].reverse())
    console.log(
      `\n=== 효율 검증 2 ===\n    정방향: ${a.order.length}곳 비용 ${a.schedule.cost.toFixed(1)} 복귀 ${toHHMM(a.schedule.endArrive)}\n    역방향: ${b.order.length}곳 비용 ${b.schedule.cost.toFixed(1)} 복귀 ${toHHMM(b.schedule.endArrive)}`,
    )
    expect(a.order.length).toBe(b.order.length)
    expect(a.schedule.cost).toBeCloseTo(b.schedule.cost, 9)
  })
})
