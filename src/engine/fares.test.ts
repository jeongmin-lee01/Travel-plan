import { describe, expect, it } from 'vitest'
import { computeDay, defaultData, emptyState, makeTravel, toggle, toMin } from './index'

const D1 = '2026-11-23'
const D2 = '2026-11-24'
const D3 = '2026-11-25'
const D4 = '2026-11-26'
const place = (id: string) => defaultData.places.find((p) => p.id === id)!
const travel = makeTravel(defaultData)

describe('요금·이동시간 계산 검증', () => {
  it('공항 ↔ 숙소: 라피트 1,670엔(2026-04 개정 반영) 60분, 공항급행 970엔', () => {
    const leg = travel(place('kix'), place('hotel'))
    console.log(`\n=== 공항 ↔ 숙소 ===\n    ${leg.minutes}분 ${leg.fareYen}엔 (${leg.detail})`)
    expect(leg.mode).toBe('longhaul')
    expect(leg.minutes).toBe(60)
    expect(leg.fareYen).toBe(1670)
    const express = makeTravel(defaultData, { 'kix-osaka': 'airport-express' })(place('kix'), place('hotel'))
    expect(express.fareYen).toBe(970)
    expect(express.minutes).toBe(71)
  })

  it('시내 전철 요금은 실제 요금표: 오사카메트로 3km 이하 190엔, 교토 220엔', () => {
    const osaka = travel(place('hotel'), place('animate-nipponbashi'))
    const kyoto = travel(place('yodobashi-kyoto'), place('pokemon-center-kyoto'))
    console.log(`    오사카 ${osaka.mode} ${osaka.minutes}분 ${osaka.fareYen}엔 / 교토 ${kyoto.mode} ${kyoto.minutes}분 ${kyoto.fareYen}엔`)
    expect(osaka.mode).toBe('train')
    expect(osaka.fareYen).toBe(190)
    expect(kyoto.mode).toBe('train')
    expect(kyoto.fareYen).toBe(220)
    // 가까우면 걸어가고 요금이 없다
    expect(travel(place('pokemon-center-kyoto'), place('surugaya-teramachi')).fareYen).toBe(0)
  })
})

describe('하루 합계에 고정 이동(공항·USJ)이 포함된다', () => {
  it('Day 1(입국): 후보가 없어도 공항 → 숙소 60분 · 1,670엔이 합계에 있다', () => {
    const t = computeDay(defaultData, emptyState(), D1).schedule.totals
    console.log(`\n=== 합계 ===\n    Day 1(빈 날): ${t.travelMin}분 ${t.fareYen}엔`)
    expect(t.fixedLegMin).toBe(60)
    expect(t.fixedLegFareYen).toBe(1670)
    expect(t.travelMin).toBe(60)
    expect(t.fareYen).toBe(1670)
  })

  it('Day 4(출국): 숙소 → 공항 이동이 후보 이동과 함께 합쳐진다', () => {
    const s = toggle(defaultData, emptyState(), 'parco-shinsaibashi', { day: D4 }).state
    const sch = computeDay(defaultData, s, D4).schedule
    const legs = sch.stops.reduce((a, st) => a + (st.travel?.minutes ?? 0), 0) + (sch.returnTravel?.minutes ?? 0)
    const fares = sch.stops.reduce((a, st) => a + (st.travel?.fareYen ?? 0), 0) + (sch.returnTravel?.fareYen ?? 0)
    console.log(`    Day 4: 후보 이동 ${legs}분 ${fares}엔 + 공항 ${sch.totals.fixedLegMin}분 ${sch.totals.fixedLegFareYen}엔 = ${sch.totals.travelMin}분 ${sch.totals.fareYen}엔`)
    expect(sch.totals.fixedLegMin).toBe(60)
    expect(sch.totals.travelMin).toBe(legs + 60)
    expect(sch.totals.fareYen).toBe(fares + 1670)
  })

  it('Day 3(USJ): 숙소 ↔ USJ 왕복이 합계에 있다', () => {
    const sch = computeDay(defaultData, emptyState(), D3).schedule
    const one = travel(place('hotel'), place('usj'))
    console.log(`    Day 3: USJ 왕복 ${sch.totals.travelMin}분 ${sch.totals.fareYen}엔 (편도 ${one.minutes}분 ${one.fareYen}엔)`)
    expect(sch.totals.travelMin).toBe(one.minutes * 2)
    expect(sch.totals.fareYen).toBe(one.fareYen * 2)
  })

  it('Day 2는 고정 이동이 없다(교토 이동은 후보를 넣을 때 후보 이동에 포함)', () => {
    const t = computeDay(defaultData, emptyState(), D2).schedule.totals
    expect(t.travelMin).toBe(0)
    expect(t.fareYen).toBe(0)
    const s = toggle(defaultData, emptyState(), 'pokemon-center-kyoto', { day: D2 }).state
    const t2 = computeDay(defaultData, s, D2).schedule.totals
    expect(t2.fixedLegMin).toBe(0)
    expect(t2.travelMin).toBeGreaterThanOrEqual(2 * 74) // 숙소 ↔ 교토 왕복
  })
})

describe('이동 시간과 카드 시각이 맞아떨어진다', () => {
  it('각 방문지의 도착 시각 = 이전 출발 시각 + 이동 + 여유, 합계의 여유 = 구간별 여유의 합', () => {
    let s = emptyState()
    for (const id of ['parco-shinsaibashi', 'animate-nipponbashi', 'gu-namba-marui']) s = toggle(defaultData, s, id, { day: D1 }).state
    const sch = computeDay(defaultData, s, D1).schedule
    const d = defaultData.itinerary.defaults
    let prevEnd = toMin(defaultData.itinerary.days[0].freeWindow!.start)
    let buffers = 0
    for (const st of sch.stops) {
      const buf = st.travel!.minutes === 0 ? 0 : st.travel!.mode === 'walk' ? d.bufferWalkMin : d.bufferTransitMin
      expect(st.arrive).toBe(prevEnd + st.travel!.minutes + buf)
      buffers += buf
      prevEnd = st.end
    }
    const r = sch.returnTravel!
    const rbuf = r.minutes === 0 ? 0 : r.mode === 'walk' ? d.bufferWalkMin : d.bufferTransitMin
    expect(sch.endArrive).toBe(prevEnd + r.minutes + rbuf)
    expect(sch.totals.bufferMin).toBe(buffers + rbuf)
  })
})
