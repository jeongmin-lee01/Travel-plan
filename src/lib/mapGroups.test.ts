import { describe, expect, it } from 'vitest'
import { computeDay, defaultData, emptyState, toggle } from '../engine'
import type { PlanState } from '../types'
import { buildDayMap, googleRouteUrl } from './mapGroups'

const D1 = '2026-11-23'
const D2 = '2026-11-24'
const D3 = '2026-11-25'
const D4 = '2026-11-26'
const day = (d: string) => defaultData.itinerary.days.find((x) => x.date === d)!
const kix = defaultData.places.find((p) => p.id === 'kix')!
const hotel = defaultData.places.find((p) => p.id === 'hotel')!

function stateWith(entries: [string, string][]): PlanState {
  let s = emptyState()
  for (const [id, d] of entries) s = toggle(defaultData, s, id, { day: d }).state
  return s
}
const ids = (m: NonNullable<ReturnType<typeof buildDayMap>>) => m.path.map((p) => p.n ?? p.id)

describe('입국일(Day 1)·출국일(Day 4)은 항상 간사이공항과 이어진다', () => {
  it('Day 1: 공항 → 숙소 → 1번 → … → 숙소', () => {
    const s = stateWith([
      ['parco-shinsaibashi', D1],
      ['animate-nipponbashi', D1],
    ])
    const m = buildDayMap(defaultData, day(D1), computeDay(defaultData, s, D1), s, false)!
    console.log('\n=== Day 1 경로 ===\n    ' + ids(m).join(' → '))
    expect(m.path[0].id).toBe('kix')
    expect(m.path[0].icon).toBe('plane')
    expect(m.path[1].id).toBe('hotel')
    expect(m.path[m.path.length - 1].id).toBe('hotel')
    expect(m.path.filter((p) => p.kind === 'route')).toHaveLength(2)
    expect(m.airport).toBe(true)
    expect(m.hasLongLeg).toBe(true) // 공항 ↔ 숙소는 먼 구간(점선)
  })

  it('Day 4: 숙소 → 1번 → … → 숙소 → 공항', () => {
    const s = stateWith([['parco-shinsaibashi', D4]])
    const m = buildDayMap(defaultData, day(D4), computeDay(defaultData, s, D4), s, false)!
    console.log('=== Day 4 경로 ===\n    ' + ids(m).join(' → '))
    expect(m.path[0].id).toBe('hotel')
    expect(m.path[m.path.length - 1].id).toBe('kix')
    expect(m.path[m.path.length - 2].id).toBe('hotel')
    expect(m.airport).toBe(true)
  })

  it('후보를 하나도 체크하지 않아도 공항과 숙소는 이어져 있다', () => {
    const d1 = buildDayMap(defaultData, day(D1), computeDay(defaultData, emptyState(), D1), emptyState(), false)!
    expect(d1.path.map((p) => p.id)).toEqual(['kix', 'hotel'])
    const d4 = buildDayMap(defaultData, day(D4), computeDay(defaultData, emptyState(), D4), emptyState(), false)!
    expect(d4.path.map((p) => p.id)).toEqual(['hotel', 'kix'])
  })

  it('공항이 들어간 날은 "전체 경로"로 공항까지 지도에 담을 수 있다', () => {
    const s = stateWith([['parco-shinsaibashi', D1]])
    const m = buildDayMap(defaultData, day(D1), computeDay(defaultData, s, D1), s, false)!
    expect(m.fitAll.some((p) => p.id === 'kix')).toBe(true)
    expect(m.fit.some((p) => p.id === 'kix')).toBe(false) // 가까이 보기에는 방문 지점 위주
  })

  it('다른 날(Day 2, Day 3)은 공항과 이어지지 않는다', () => {
    const s = stateWith([['pokemon-center-kyoto', D2]])
    const d2 = buildDayMap(defaultData, day(D2), computeDay(defaultData, s, D2), s, false)!
    expect(d2.path.some((p) => p.id === 'kix')).toBe(false)
    expect(d2.airport).toBe(false)
    const d3 = buildDayMap(defaultData, day(D3), computeDay(defaultData, emptyState(), D3), emptyState(), false)!
    expect(d3.path.map((p) => p.id)).toEqual(['hotel', 'usj', 'hotel'])
  })

  it('구글맵 링크: 입국일은 공항에서 출발, 출국일은 공항으로 도착', () => {
    const s1 = stateWith([['parco-shinsaibashi', D1]])
    const u1 = new URL(googleRouteUrl(defaultData, day(D1), computeDay(defaultData, s1, D1))!)
    expect(u1.searchParams.get('origin')).toBe(`${kix.lat},${kix.lng}`)
    expect(u1.searchParams.get('destination')).toBe(`${hotel.lat},${hotel.lng}`)
    expect(u1.searchParams.get('waypoints')!.split('|')[0]).toBe(`${hotel.lat},${hotel.lng}`)

    const s4 = stateWith([['parco-shinsaibashi', D4]])
    const u4 = new URL(googleRouteUrl(defaultData, day(D4), computeDay(defaultData, s4, D4))!)
    expect(u4.searchParams.get('origin')).toBe(`${hotel.lat},${hotel.lng}`)
    expect(u4.searchParams.get('destination')).toBe(`${kix.lat},${kix.lng}`)

    // 후보가 없어도 공항 ↔ 숙소 링크는 있다. Day 2는 후보가 없으면 링크 없음
    expect(googleRouteUrl(defaultData, day(D1), computeDay(defaultData, emptyState(), D1))).not.toBeNull()
    expect(googleRouteUrl(defaultData, day(D2), computeDay(defaultData, emptyState(), D2))).toBeNull()
  })
})
