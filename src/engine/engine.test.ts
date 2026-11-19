import { describe, expect, it } from 'vitest'
import {
  applyOrder,
  computeDay,
  computePlan,
  defaultData,
  emptyState,
  makeCtx,
  makeTravel,
  optimizeDay,
  reoptimize,
  simulate,
  toggle,
  toHHMM,
} from './index'
import type { DaySchedule, EngineData, PlanState, ToggleResult } from '../types'

const D1 = '2026-11-23'
const D2 = '2026-11-24'
const D3 = '2026-11-25'
const D4 = '2026-11-26'
const nameOf = (data: EngineData, id: string) => data.places.find((p) => p.id === id)!.name.ko

function show(data: EngineData, sch: DaySchedule): string {
  const rows = sch.stops.map((s) => {
    const label = nameOf(data, s.placeId!)
    const wait = s.waitMin > 0 ? ` (대기 ${s.waitMin}분)` : ''
    return `    ${toHHMM(s.start)}~${toHHMM(s.end)} ${label}${wait}`
  })
  return [...rows, `    ${toHHMM(sch.endArrive)} 숙소 도착 | 이동 ${sch.totals.travelMin}분 · ${sch.totals.steps.toLocaleString('ko-KR')}보 · ${sch.totals.fareYen}엔`].join('\n')
}

function logToggle(data: EngineData, r: ToggleResult) {
  const tag = r.action === 'added' ? '체크' : r.action === 'removed' ? '해제' : '막힘'
  const head = `[${tag}] ${nameOf(data, r.placeId)}${r.day ? ` → ${r.day}` : ''}`
  if (r.action === 'blocked') {
    console.log(`${head}\n    이유: ${r.reason}\n    빼면 좋은 후보: ${r.dropSuggestions.map((d) => `${nameOf(data, d.dropPlaceId)}${d.makesFeasible ? '(빼면 가능)' : ''}`).join(', ') || '없음'}`)
    return
  }
  const d = r.diff!
  console.log(
    `${head}\n    순서: ${d.orderAfter.map((id) => nameOf(data, id)).join(' → ')}\n    변화: 이동 ${d.addedTravelMin >= 0 ? '+' : ''}${d.addedTravelMin}분, 걸음 ${d.addedSteps >= 0 ? '+' : ''}${d.addedSteps.toLocaleString('ko-KR')}보, 순서 ${d.orderChanged ? '바뀜' : '그대로'}, 복귀 ${toHHMM(d.endArriveBefore)}→${toHHMM(d.endArriveAfter)}`,
  )
}

const KYOTO5 = ['pokemon-center-kyoto', 'mandarake-kyoto', 'surugaya-teramachi', 'yodobashi-kyoto', 'champion-kyoto']

describe('시나리오 1: 교토 후보 5곳을 체크하면 Day 2 동선이 그때그때 다시 짜인다', () => {
  it('하나씩 체크할 때 순서 변화', () => {
    let state: PlanState = emptyState()
    console.log('\n=== 시나리오 1: 교토 후보 5곳 체크 ===')
    for (const id of KYOTO5) {
      const r = toggle(defaultData, state, id)
      logToggle(defaultData, r)
      expect(r.action).toBe('added')
      expect(r.day).toBe(D2) // 교토 후보는 11/24에만 갈 수 있음
      state = r.state
    }
    const day = computeDay(defaultData, state, D2)
    console.log('최종 Day 2:\n' + show(defaultData, day.schedule))
    expect(day.order).toHaveLength(5)
    expect(day.schedule.feasible).toBe(true)
  })

  it('체크 해제하면 후보로 돌아가고(삭제 아님) 순서가 다시 계산된다', () => {
    let state = emptyState()
    for (const id of KYOTO5) state = toggle(defaultData, state, id).state
    const r = toggle(defaultData, state, 'mandarake-kyoto')
    console.log('\n=== 해제 ===')
    logToggle(defaultData, r)
    expect(r.action).toBe('removed')
    expect(computeDay(defaultData, r.state, D2).order).not.toContain('mandarake-kyoto')
    expect(defaultData.places.some((p) => p.id === 'mandarake-kyoto')).toBe(true)
  })

  it('같은 체인(GU) 2곳이면 "하나만 가도 될까요?" 안내', () => {
    let state = emptyState()
    state = toggle(defaultData, state, 'gu-kyoto-avanti').state
    const r = toggle(defaultData, state, 'gu-kyoto-yodobashi')
    console.log('\n=== 체인 안내 ===\n    ' + r.flags.filter((f) => f.code === 'chain-duplicate').map((f) => f.message).join('\n    '))
    expect(r.flags.some((f) => f.code === 'chain-duplicate')).toBe(true)
  })
})

describe('시나리오 2: 갈 수 없는 날에는 막힌다', () => {
  it('교토 후보를 오사카 날(11/23)이나 USJ 날(11/25)에, 오사카 후보를 교토 날에 넣으면 막힘', () => {
    console.log('\n=== 시나리오 2: 막히는 경우 ===')
    const cases: [string, string][] = [
      ['pokemon-center-kyoto', D1],
      ['pokemon-center-kyoto', D3],
      ['animate-nipponbashi', D2],
      ['animate-nipponbashi', D3],
    ]
    for (const [id, day] of cases) {
      const r = toggle(defaultData, emptyState(), id, { day })
      logToggle(defaultData, r)
      expect(r.action).toBe('blocked')
      expect(r.state).toEqual(emptyState())
    }
  })

  it('좌표가 없는 후보(와르고, 지점 미정 GU)는 넣을 수 없음', () => {
    for (const id of ['wargo-gion', 'lashinbang-kyoto2', 'gu-unnamed']) {
      const r = toggle(defaultData, emptyState(), id)
      console.log(`[막힘] ${nameOf(defaultData, id)}: ${r.reason}`)
      expect(r.action).toBe('blocked')
    }
  })

  it('오사카 후보는 자동으로 11/23이나 11/26 중 잘 맞는 날을 고른다', () => {
    const r = toggle(defaultData, emptyState(), 'parco-shinsaibashi')
    console.log('\n=== 가장 잘 맞는 날 ===\n' + r.rankedDays.map((d) => `    ${d.day}: ${d.feasible ? `가능, 늘어나는 비용 ${d.addedCost}` : d.reason}`).join('\n'))
    expect([D1, D4]).toContain(r.day)
  })
})

describe('시나리오 3: Day 4에 너무 많이 넣으면 공항 시각 경고', () => {
  it('체류시간을 늘려 하루에 다 못 넣으면 막히고, 뺄 후보를 제안한다', () => {
    console.log('\n=== 시나리오 3: Day 4 과다 ===')
    let state = emptyState()
    let blockedOnce: ToggleResult | undefined
    for (const id of ['animate-nipponbashi', 'parco-shinsaibashi', 'gu-namba-marui']) {
      const r = toggle(defaultData, state, id, { day: D4, stayMinutes: 110 })
      logToggle(defaultData, r)
      if (r.action === 'blocked') blockedOnce = r
      else state = r.state
    }
    expect(blockedOnce).toBeDefined()
    console.log('Day 4 현재:\n' + show(defaultData, computeDay(defaultData, state, D4).schedule))
  })

  it('손으로 시각을 어기게 만든 순서는 공항 경고(airport-deadline)를 낸다', () => {
    const day = defaultData.itinerary.days.find((d) => d.date === D4)!
    const state: PlanState = {
      checked: {
        'animate-nipponbashi': { day: D4, stayMinutes: 150 },
        'parco-shinsaibashi': { day: D4, stayMinutes: 150 },
      },
      manualOrder: {},
    }
    const c = makeCtx(defaultData, day, state.checked, makeTravel(defaultData))
    const sch = simulate(c, ['animate-nipponbashi', 'parco-shinsaibashi'])
    console.log('\n=== 공항 경고 ===\n    ' + sch.flags.filter((f) => f.severity === 'block').map((f) => f.message).join('\n    '))
    expect(sch.flags.some((f) => f.code === 'airport-deadline')).toBe(true)
    expect(sch.feasible).toBe(false)
  })
})

describe('손으로 바꾼 순서 · 저장 데이터', () => {
  it('손으로 바꾼 순서가 자동 최적화보다 우선하고, 다시 최적화하면 돌아온다', () => {
    let state = emptyState()
    for (const id of KYOTO5) state = toggle(defaultData, state, id).state
    const auto = computeDay(defaultData, state, D2).order
    const reversed = [...auto].reverse()
    const manual = applyOrder(state, D2, reversed)
    expect(computeDay(defaultData, manual, D2).order).toEqual(reversed)
    expect(computeDay(defaultData, manual, D2).manual).toBe(true)
    expect(computeDay(defaultData, reoptimize(manual, D2), D2).order).toEqual(auto)
  })

  it('상태를 JSON으로 저장했다가 불러와도 같은 동선이 나온다', () => {
    let state = emptyState()
    for (const id of KYOTO5) state = toggle(defaultData, state, id).state
    const restored: PlanState = JSON.parse(JSON.stringify(state))
    expect(computePlan(defaultData, restored)).toEqual(computePlan(defaultData, state))
  })
})

describe('최적화 품질', () => {
  it('정확 탐색 결과가 무작위 순서보다 비용이 작거나 같다', () => {
    const day = defaultData.itinerary.days.find((d) => d.date === D2)!
    const ids = ['pokemon-center-kyoto', 'mandarake-kyoto', 'surugaya-teramachi', 'champion-kyoto', 'guf-kyoto', 'edion-kawaramachi']
    const entries = Object.fromEntries(ids.map((id) => [id, { day: D2 }]))
    const c = makeCtx(defaultData, day, entries, makeTravel(defaultData))
    const best = optimizeDay(c, ids)
    let bestRandom = Infinity
    for (let i = 0; i < 300; i++) {
      const perm = [...ids].sort(() => Math.random() - 0.5)
      const s = simulate(c, perm)
      if (s.feasible) bestRandom = Math.min(bestRandom, s.cost)
    }
    console.log(`\n=== 최적화 품질 ===\n    정확 탐색 비용 ${best.schedule.cost.toFixed(1)} ≤ 무작위 300개 중 최선 ${bestRandom.toFixed(1)}`)
    expect(best.method).toBe('exact')
    expect(best.schedule.cost).toBeLessThanOrEqual(bestRandom + 1e-9)
  })

  it('10곳 이상이면 휴리스틱으로 전환되고 빠르게 끝난다', () => {
    const base = defaultData.places.find((p) => p.id === 'pokemon-center-kyoto')!
    const fakes = Array.from({ length: 11 }, (_, i) => ({
      ...base,
      id: `fake-${i}`,
      name: { ko: `가상${i}`, ja: `fake${i}` },
      lat: base.lat! + ((i % 4) - 1.5) * 0.002,
      lng: base.lng! + (Math.floor(i / 4) - 1) * 0.003,
      stayMinutes: { value: 20, estimated: true },
      reservation: { ...base.reservation, kind: '불필요' },
    }))
    const data: EngineData = { ...defaultData, places: [...defaultData.places, ...fakes] }
    const day = data.itinerary.days.find((d) => d.date === D2)!
    const ids = fakes.map((f) => f.id)
    const entries = Object.fromEntries(ids.map((id) => [id, { day: D2 }]))
    const c = makeCtx(data, day, entries, makeTravel(data))
    const t0 = Date.now()
    const r = optimizeDay(c, ids)
    const ms = Date.now() - t0
    console.log(`\n=== 휴리스틱 ===\n    ${ids.length}곳 → 방식 ${r.method}, ${ms}ms, 가능 ${r.feasible}`)
    expect(r.method).toBe('heuristic')
    expect(r.order).toHaveLength(11)
    expect(ms).toBeLessThan(5000)
  })
})
