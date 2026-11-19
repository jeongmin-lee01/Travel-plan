import { describe, expect, it } from 'vitest'
import {
  applyOrder,
  computeDay,
  computePlan,
  daysOf,
  defaultData,
  emptyState,
  entryKey,
  makeCtx,
  makeTravel,
  reoptimize,
  simulate,
  toggle,
  toHHMM,
  withoutPlace,
} from './index'
import type { DaySchedule, EngineData, PlanState, ToggleResult } from '../types'

const D1 = '2026-11-23'
const D2 = '2026-11-24'
const D3 = '2026-11-25'
const D4 = '2026-11-26'
const nameOf = (data: EngineData, id: string) => data.places.find((p) => p.id === id)!.name.ko

function show(data: EngineData, sch: DaySchedule): string {
  const rows = sch.stops.map((s) => {
    const wait = s.waitMin > 0 ? ` (대기 ${s.waitMin}분)` : ''
    return `    ${toHHMM(s.start)}~${toHHMM(s.end)} ${nameOf(data, s.placeId!)}${wait}`
  })
  return [...rows, `    ${toHHMM(sch.endArrive)} 숙소 도착 | 이동 ${sch.totals.travelMin}분 · ${sch.totals.steps.toLocaleString('ko-KR')}보 · ${sch.totals.fareYen}엔`].join('\n')
}

function logToggle(data: EngineData, r: ToggleResult) {
  const tag = r.action === 'added' ? '체크' : r.action === 'removed' ? '해제' : '막힘'
  const head = `[${tag}] ${nameOf(data, r.placeId)}${r.day ? ` → ${r.day}` : ''}`
  if (r.action === 'blocked') {
    console.log(`${head}\n    이유: ${r.reason}`)
    return
  }
  const d = r.diff!
  console.log(
    `${head}\n    순서: ${d.orderAfter.map((id) => nameOf(data, id)).join(' → ')}\n    변화: 이동 ${d.addedTravelMin >= 0 ? '+' : ''}${d.addedTravelMin}분, 걸음 ${d.addedSteps >= 0 ? '+' : ''}${d.addedSteps.toLocaleString('ko-KR')}보, 순서 ${d.orderChanged ? '바뀜' : '그대로'}, 복귀 ${toHHMM(d.endArriveBefore)}→${toHHMM(d.endArriveAfter)}${r.cautions.length ? `\n    주의: ${r.cautions.join(' / ')}` : ''}`,
  )
}

const KYOTO5 = ['pokemon-center-kyoto', 'mandarake-kyoto', 'surugaya-teramachi', 'yodobashi-kyoto', 'champion-kyoto']

describe('시나리오 1: 교토 후보 5곳을 Day 2에 체크하면 동선이 그때그때 다시 짜인다', () => {
  it('하나씩 체크할 때 순서 변화', () => {
    let state: PlanState = emptyState()
    console.log('\n=== 시나리오 1: 교토 후보 5곳 체크 ===')
    for (const id of KYOTO5) {
      const r = toggle(defaultData, state, id, { day: D2 })
      logToggle(defaultData, r)
      expect(r.action).toBe('added')
      expect(r.cautions).toEqual([]) // 교토 후보를 교토 날에 넣으면 주의할 게 없다
      state = r.state
    }
    const day = computeDay(defaultData, state, D2)
    console.log('최종 Day 2:\n' + show(defaultData, day.schedule))
    expect(day.order).toHaveLength(5)
    expect(day.schedule.feasible).toBe(true)
  })

  it('체크를 해제하면 그 날 동선에서만 빠지고 후보로 돌아간다(삭제 아님)', () => {
    let state = emptyState()
    for (const id of KYOTO5) state = toggle(defaultData, state, id, { day: D2 }).state
    const r = toggle(defaultData, state, 'mandarake-kyoto', { day: D2 })
    console.log('\n=== 해제 ===')
    logToggle(defaultData, r)
    expect(r.action).toBe('removed')
    expect(computeDay(defaultData, r.state, D2).order).not.toContain('mandarake-kyoto')
    expect(defaultData.places.some((p) => p.id === 'mandarake-kyoto')).toBe(true)
  })

  it('같은 체인(GU) 2곳이면 "하나만 가도 될까요?" 안내', () => {
    let state = emptyState()
    state = toggle(defaultData, state, 'gu-kyoto-avanti', { day: D2 }).state
    const r = toggle(defaultData, state, 'gu-kyoto-yodobashi', { day: D2 })
    console.log('\n=== 체인 안내 ===\n    ' + r.cautions.join('\n    '))
    expect(r.cautions.some((c) => c.includes('하나만 가도 될까요'))).toBe(true)
  })
})

describe('시나리오 2: 막지 않고 주의 문구만 띄운다', () => {
  it('교토 후보를 오사카 날에, 오사카 후보를 교토 날에 체크해도 추가되고 지역 주의가 나온다', () => {
    console.log('\n=== 시나리오 2: 지역이 맞지 않는 날 ===')
    const cases: [string, string, string][] = [
      ['pokemon-center-kyoto', D1, '교토 지역이에요'],
      ['pokemon-center-kyoto', D4, '교토 지역이에요'],
      ['animate-nipponbashi', D2, '오사카 지역이에요'],
    ]
    for (const [id, day, expected] of cases) {
      const r = toggle(defaultData, emptyState(), id, { day })
      logToggle(defaultData, r)
      expect(r.action).toBe('added')
      expect(r.cautions.some((c) => c.includes(expected))).toBe(true)
      expect(r.cautions.some((c) => c.includes('추천해요'))).toBe(true)
      expect(daysOf(r.state, id)).toEqual([day])
    }
  })

  it('이미 다른 날에 넣은 장소를 체크하면 "이미 추가된 장소예요"를 알리고, 두 날 모두에 들어간다', () => {
    let state = emptyState()
    state = toggle(defaultData, state, 'parco-shinsaibashi', { day: D1 }).state
    const r = toggle(defaultData, state, 'parco-shinsaibashi', { day: D4 })
    console.log('\n=== 같은 장소를 두 날에 ===\n    ' + r.cautions.join(' / '))
    expect(r.action).toBe('added')
    expect(r.cautions).toContain('Day 1에 이미 추가된 장소예요')
    expect(daysOf(r.state, 'parco-shinsaibashi').sort()).toEqual([D1, D4])
    expect(computeDay(defaultData, r.state, D1).order).toContain('parco-shinsaibashi')
    expect(computeDay(defaultData, r.state, D4).order).toContain('parco-shinsaibashi')
  })

  it('한 날에서 해제해도 다른 날의 체크는 그대로다', () => {
    let state = emptyState()
    state = toggle(defaultData, state, 'parco-shinsaibashi', { day: D1 }).state
    state = toggle(defaultData, state, 'parco-shinsaibashi', { day: D4 }).state
    const r = toggle(defaultData, state, 'parco-shinsaibashi', { day: D4 })
    expect(r.action).toBe('removed')
    expect(daysOf(r.state, 'parco-shinsaibashi')).toEqual([D1])
    expect(computeDay(defaultData, r.state, D4).order).toEqual([])
    // 후보 목록에서 제거하면 모든 날에서 빠진다
    expect(daysOf(withoutPlace(state, 'parco-shinsaibashi'), 'parco-shinsaibashi')).toEqual([])
  })

  it('위치가 없는 후보와 하루 종일 일정(USJ) 날만 막는다', () => {
    for (const id of ['wargo-gion', 'lashinbang-kyoto2', 'gu-unnamed']) {
      const r = toggle(defaultData, emptyState(), id, { day: D2 })
      console.log(`[막힘] ${nameOf(defaultData, id)}: ${r.reason}`)
      expect(r.action).toBe('blocked')
    }
    const usj = toggle(defaultData, emptyState(), 'pokemon-center-kyoto', { day: D3 })
    console.log(`[막힘] Day 3: ${usj.reason}`)
    expect(usj.action).toBe('blocked')
  })
})

describe('시나리오 3: Day 4에 너무 많이 넣어도 막지 않고 공항 시각을 경고한다', () => {
  it('체류시간을 늘려 하루에 다 못 들어가면 주의 문구에 공항 시각이 나온다', () => {
    console.log('\n=== 시나리오 3: Day 4 과다 ===')
    let state = emptyState()
    let warned = false
    for (const id of ['animate-nipponbashi', 'parco-shinsaibashi', 'gu-namba-marui']) {
      const r = toggle(defaultData, state, id, { day: D4, stayMinutes: 110 })
      logToggle(defaultData, r)
      expect(r.action).toBe('added')
      state = r.state
      if (r.cautions.some((c) => c.includes('공항'))) warned = true
    }
    expect(warned).toBe(true)
    const sch = computeDay(defaultData, state, D4).schedule
    expect(sch.feasible).toBe(false)
    console.log('Day 4 현재:\n' + show(defaultData, sch))
  })

  it('손으로 시각을 어기게 만든 순서도 공항 경고(airport-deadline)를 낸다', () => {
    const day = defaultData.itinerary.days.find((d) => d.date === D4)!
    const checked: PlanState['checked'] = {
      [entryKey('animate-nipponbashi', D4)]: { placeId: 'animate-nipponbashi', day: D4, stayMinutes: 150 },
      [entryKey('parco-shinsaibashi', D4)]: { placeId: 'parco-shinsaibashi', day: D4, stayMinutes: 150 },
    }
    const c = makeCtx(defaultData, day, checked, makeTravel(defaultData))
    const sch = simulate(c, ['animate-nipponbashi', 'parco-shinsaibashi'])
    expect(sch.flags.some((f) => f.code === 'airport-deadline')).toBe(true)
    expect(sch.feasible).toBe(false)
  })
})

describe('손으로 바꾼 순서 · 저장 데이터', () => {
  it('손으로 바꾼 순서가 자동 최적화보다 우선하고, 다시 최적화하면 돌아온다', () => {
    let state = emptyState()
    for (const id of KYOTO5) state = toggle(defaultData, state, id, { day: D2 }).state
    const auto = computeDay(defaultData, state, D2).order
    const reversed = [...auto].reverse()
    const manual = applyOrder(state, D2, reversed)
    expect(computeDay(defaultData, manual, D2).order).toEqual(reversed)
    expect(computeDay(defaultData, manual, D2).manual).toBe(true)
    expect(computeDay(defaultData, reoptimize(manual, D2), D2).order).toEqual(auto)
  })

  it('상태를 JSON으로 저장했다가 불러와도 같은 동선이 나온다(여러 날 체크 포함)', () => {
    let state = emptyState()
    for (const id of KYOTO5) state = toggle(defaultData, state, id, { day: D2 }).state
    state = toggle(defaultData, state, 'parco-shinsaibashi', { day: D1 }).state
    state = toggle(defaultData, state, 'parco-shinsaibashi', { day: D4 }).state
    const restored: PlanState = JSON.parse(JSON.stringify(state))
    expect(computePlan(defaultData, restored)).toEqual(computePlan(defaultData, state))
  })

  it('날짜마다 체류시간을 따로 고칠 수 있다', () => {
    let state = emptyState()
    state = toggle(defaultData, state, 'parco-shinsaibashi', { day: D1, stayMinutes: 120 }).state
    state = toggle(defaultData, state, 'parco-shinsaibashi', { day: D4, stayMinutes: 30 }).state
    const stay = (d: string) => {
      const s = computeDay(defaultData, state, d).schedule.stops[0]
      return s.end - s.start
    }
    expect(stay(D1)).toBe(120)
    expect(stay(D4)).toBe(30)
  })
})
