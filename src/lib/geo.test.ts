import { describe, expect, it } from 'vitest'
import { deriveRegion, parseMapsLink } from './geo'

describe('구글맵 링크 읽기', () => {
  it('@좌표 형식', () => {
    const r = parseMapsLink('https://www.google.com/maps/place/Pokemon+Center/@35.0042,135.7595,17z/data=!3m1')
    expect(r).toEqual({ ok: true, lat: 35.0042, lng: 135.7595 })
  })
  it('!3d!4d 핀 좌표 형식(@보다 정확)', () => {
    const r = parseMapsLink('https://www.google.com/maps/place/x/data=!4m6!3d34.6724!4d135.5013')
    expect(r).toEqual({ ok: true, lat: 34.6724, lng: 135.5013 })
  })
  it('?q=좌표 형식과 "위도, 경도" 글자', () => {
    expect(parseMapsLink('https://maps.google.com/?q=34.66,135.507')).toEqual({ ok: true, lat: 34.66, lng: 135.507 })
    expect(parseMapsLink('34.9858, 135.7588')).toEqual({ ok: true, lat: 34.9858, lng: 135.7588 })
  })
  it('짧은 링크·좌표 없음·일본 밖은 이유와 함께 거절', () => {
    expect(parseMapsLink('https://maps.app.goo.gl/abc123')).toMatchObject({ ok: false })
    expect(parseMapsLink('https://example.com')).toMatchObject({ ok: false })
    expect(parseMapsLink('@37.77,-122.41')).toMatchObject({ ok: false })
    expect(parseMapsLink('')).toMatchObject({ ok: false })
  })
})

describe('좌표로 지역 정하기', () => {
  it('교토역 근처 / 가와라마치 / 오사카 닛폰바시 / 신사이바시 / 밖', () => {
    expect(deriveRegion({ lat: 34.9807, lng: 135.76 })).toMatchObject({ area: '교토-교토역 주변', dates: ['2026-11-24'] })
    expect(deriveRegion({ lat: 35.0036, lng: 135.7685 })).toMatchObject({ area: '교토-가와라마치/시조' })
    expect(deriveRegion({ lat: 34.66, lng: 135.507 })).toMatchObject({ area: '오사카-닛폰바시', dates: ['2026-11-23', '2026-11-26'] })
    expect(deriveRegion({ lat: 34.6724, lng: 135.5013 })).toMatchObject({ area: '오사카-신사이바시/난바' })
    expect(deriveRegion({ lat: 35.68, lng: 139.76 })).toMatchObject({ city: 'other', dates: [] })
  })
})
