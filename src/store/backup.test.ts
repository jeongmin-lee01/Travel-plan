import { describe, expect, it } from 'vitest'
import { defaultData, emptyState, toggle } from '../engine'
import { buildBackup, DEFAULT_SETTINGS, parseBackup, sanitizeSettings } from './backup'
import { emptyUserData } from './userData'

const D1 = '2026-11-23'

describe('백업 내보내기/불러오기', () => {
  it('내보낸 파일을 그대로 불러오면 체크·순서·설정이 같다', () => {
    let state = emptyState()
    state = toggle(defaultData, state, 'parco-shinsaibashi', { day: D1 }).state
    state = toggle(defaultData, state, 'animate-nipponbashi', { day: D1 }).state
    state = { ...state, manualOrder: { [D1]: ['animate-nipponbashi', 'parco-shinsaibashi'] } }
    const userData = { ...emptyUserData(), hidden: ['gu-namba-marui'], edits: { 'gu-namba-marui': { lat: 34.66, lng: 135.5 } } }
    const text = JSON.stringify(buildBackup(state, userData, { yenToWon: 9.4 }))
    const r = parseBackup(text)
    expect(r.ok).toBe(true)
    if (!r.ok) return
    expect(r.state).toEqual(state)
    expect(r.userData.hidden).toEqual(['gu-namba-marui'])
    expect(r.settings.yenToWon).toBe(9.4)
  })

  it('다른 파일·깨진 파일은 이유와 함께 거절한다', () => {
    expect(parseBackup('not json')).toMatchObject({ ok: false })
    expect(parseBackup('{"app":"other"}')).toMatchObject({ ok: false })
  })

  it('없는 장소·날짜·이상한 환율은 걸러낸다', () => {
    const text = JSON.stringify({
      app: 'travel-plan',
      state: { checked: { 'ghost@2026-11-23': { placeId: 'ghost', day: '2026-11-23' } }, manualOrder: {} },
      settings: { yenToWon: -3 },
    })
    const r = parseBackup(text)
    expect(r.ok && Object.keys(r.state.checked)).toEqual([])
    expect(r.ok && r.settings).toEqual(DEFAULT_SETTINGS)
    expect(sanitizeSettings(null)).toEqual(DEFAULT_SETTINGS)
  })
})
