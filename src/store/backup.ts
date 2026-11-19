import { defaultData, emptyState, entryKey } from '../engine'
import type { PlanState } from '../types'
import { sanitizeUserData, type UserData } from './userData'

/** 앱 설정. 지금은 환율 하나뿐이다 */
export interface Settings {
  /** 1엔이 몇 원인지(교통비를 원화로 어림해서 보여줄 때 쓴다) */
  yenToWon: number
}

export const DEFAULT_SETTINGS: Settings = { yenToWon: 9 }

export function sanitizeSettings(raw: unknown): Settings {
  const v = raw && typeof raw === 'object' ? (raw as Partial<Settings>).yenToWon : undefined
  return { yenToWon: typeof v === 'number' && Number.isFinite(v) && v > 0 && v < 100 ? v : DEFAULT_SETTINGS.yenToWon }
}

/** 저장된 상태에서 지금 데이터에 없는 장소·날짜는 걸러낸다(데이터가 바뀌어도 앱이 깨지지 않게) */
export function sanitizeState(raw: unknown, customIds: string[]): PlanState {
  const s = emptyState()
  if (!raw || typeof raw !== 'object') return s
  const { checked, manualOrder } = raw as Partial<PlanState>
  const dates = new Set(defaultData.itinerary.days.filter((d) => d.freeWindow).map((d) => d.date))
  const ids = new Set([...defaultData.places.filter((p) => p.type === 'candidate').map((p) => p.id), ...customIds])
  for (const [k, e] of Object.entries(checked ?? {})) {
    // 예전 형식(키가 곧 후보 id, 후보당 한 날짜)도 읽어 들인다
    const placeId = e?.placeId ?? k
    if (e && ids.has(placeId) && dates.has(e.day)) s.checked[entryKey(placeId, e.day)] = { ...e, placeId }
  }
  for (const [date, order] of Object.entries(manualOrder ?? {})) {
    if (dates.has(date) && Array.isArray(order)) s.manualOrder[date] = order.filter((id) => s.checked[entryKey(id, date)])
  }
  return s
}

/** 동행자 폰에 옮길 때 쓰는 백업 파일(JSON) */
export interface Backup {
  app: 'travel-plan'
  version: 1
  exportedAt: string
  state: PlanState
  userData: UserData
  settings: Settings
}

export function buildBackup(state: PlanState, userData: UserData, settings: Settings, now = new Date()): Backup {
  return { app: 'travel-plan', version: 1, exportedAt: now.toISOString(), state, userData, settings }
}

export type ParsedBackup = { ok: true; state: PlanState; userData: UserData; settings: Settings } | { ok: false; reason: string }

/** 백업 파일 내용 → 상태. 모르는 장소·날짜는 걸러내고, 다른 파일이면 이유를 알려준다 */
export function parseBackup(text: string): ParsedBackup {
  let raw: unknown
  try {
    raw = JSON.parse(text)
  } catch {
    return { ok: false, reason: 'JSON 파일이 아니에요. 이 앱에서 내보낸 파일을 골라 주세요.' }
  }
  const b = raw as Partial<Backup> | null
  if (!b || typeof b !== 'object' || b.app !== 'travel-plan') {
    return { ok: false, reason: '이 앱에서 내보낸 백업 파일이 아니에요.' }
  }
  const userData = sanitizeUserData(b.userData)
  return {
    ok: true,
    userData,
    state: sanitizeState(b.state, userData.custom.map((p) => p.id)),
    settings: sanitizeSettings(b.settings),
  }
}
