import { describe, expect, it } from 'vitest'
import { computeDay, defaultData, emptyState, toHHMM, toggle } from '../engine'
import { applyUserData, emptyUserData, makeCandidate, type NewCandidateInput } from './userData'

const D2 = '2026-11-24'

const base: NewCandidateInput = {
  name: '테스트 가게',
  mapsLink: 'https://www.google.com/maps/place/x/@35.0045,135.7600,17z',
  category: '굿즈',
  stayMinutes: 50,
  hours: '11:00-15:00',
  needsReservation: false,
}

function withCandidate(input: NewCandidateInput, id = 'custom-t1') {
  const { place, linkError } = makeCandidate(input, id)
  const data = applyUserData(defaultData, { ...emptyUserData(), custom: [place] })
  return { place, linkError, data }
}

describe('후보 추가', () => {
  it('링크에서 위치를 읽고 지역·갈 수 있는 날을 정해 후보로 만든다', () => {
    const { place, linkError } = makeCandidate(base, 'custom-t1')
    expect(linkError).toBeUndefined()
    expect(place).toMatchObject({ type: 'candidate', category: '굿즈', lat: 35.0045, lng: 135.76, area: '교토-가와라마치/시조', availableDates: [D2] })
    expect(place.stayMinutes.value).toBe(50)
    expect(place.reservation.kind).toBe('불필요')
  })

  it('영업시간을 비우면 확인 필요 표시', () => {
    const { place } = makeCandidate({ ...base, category: '기타', hours: '' }, 'custom-t2')
    expect(place.category).toBe('기타')
    expect(place.needsCheck).toContain('hours')
  })

  it('후보 카테고리는 굿즈/의류/식당/기타 4가지로만 나온다 (게임센터는 모두 굿즈)', () => {
    const data = applyUserData(defaultData, emptyUserData())
    const candidates = data.places.filter((p) => p.type === 'candidate')
    expect(new Set(candidates.map((p) => p.category))).toEqual(new Set(['굿즈', '의류', '기타']))
    const byName = (ko: string) => candidates.find((p) => p.name.ko.includes(ko))!
    expect(byName('GiGO 교토 신쿄고쿠')).toMatchObject({ category: '굿즈', categoryDetail: '게임센터' })
    expect(byName('GiGO 가와라마치')).toMatchObject({ category: '굿즈', categoryDetail: '게임센터' })
    expect(byName('반다이 남코')).toMatchObject({ category: '굿즈', categoryDetail: '게임센터·굿즈' })
    expect(byName('GU 난바')).toMatchObject({ category: '의류' })
  })

  it('링크가 없거나 못 읽으면 위치 없이 만들고, 못 읽은 이유를 알려준다', () => {
    expect(makeCandidate({ ...base, mapsLink: '' }, 'custom-a').place.lat).toBeNull()
    const bad = makeCandidate({ ...base, mapsLink: 'https://maps.app.goo.gl/xyz' }, 'custom-b')
    expect(bad.place.lat).toBeNull()
    expect(bad.place.needsCheck).toContain('coords')
    expect(bad.linkError).toContain('짧은 링크')
  })

  it('체크하면 기존 후보처럼 동선에 들어가고, 해제하면 후보로 돌아간다', () => {
    const { data } = withCandidate(base)
    const on = toggle(data, emptyState(), 'custom-t1', { day: D2 })
    console.log(`\n=== 후보 추가 → 체크 ===\n    ${on.action} → ${on.day}, 방문 ${toHHMM(on.after!.stops[0].start)}`)
    expect(on.action).toBe('added')
    const off = toggle(data, on.state, 'custom-t1', { day: D2 })
    expect(off.action).toBe('removed')
    expect(data.places.some((p) => p.id === 'custom-t1')).toBe(true)
  })

  it('다른 후보와 함께 순서가 다시 계산된다', () => {
    const { data } = withCandidate(base)
    let state = emptyState()
    for (const id of ['pokemon-center-kyoto', 'custom-t1', 'mandarake-kyoto']) state = toggle(data, state, id, { day: D2 }).state
    const day = computeDay(data, state, D2)
    console.log('\n=== 함께 계산 ===\n    ' + day.schedule.stops.map((s) => `${toHHMM(s.start)} ${data.places.find((p) => p.id === s.placeId)!.name.ko}`).join(' → '))
    expect(day.order).toHaveLength(3)
    expect(day.schedule.feasible).toBe(true)
  })

  it('삭제하면 데이터에서 사라진다', () => {
    const { place } = makeCandidate(base, 'custom-t1')
    const data = applyUserData(defaultData, { ...emptyUserData(), custom: [] })
    expect(data.places.some((p) => p.id === place.id)).toBe(false)
  })
})
