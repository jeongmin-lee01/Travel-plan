import type { EngineData } from '../types'
import { deriveRegion } from '../lib/geo'

/** 앱에 들어 있는 기본 데이터(places.json)는 건드리지 않고, 내가 고친 것만 따로 저장한다 */
export interface UserData {
  /** 후보 목록에서 제거(숨김)한 장소 */
  hidden: string[]
  /** 내가 지정·수정한 위치 */
  edits: Record<string, { lat: number; lng: number; address?: string }>
}

export const emptyUserData = (): UserData => ({ hidden: [], edits: {} })

export function sanitizeUserData(raw: unknown): UserData {
  const u = emptyUserData()
  if (!raw || typeof raw !== 'object') return u
  const { hidden, edits } = raw as Partial<UserData>
  if (Array.isArray(hidden)) u.hidden = hidden.filter((x): x is string => typeof x === 'string')
  for (const [id, e] of Object.entries(edits ?? {})) {
    if (e && typeof e.lat === 'number' && typeof e.lng === 'number') u.edits[id] = e
  }
  return u
}

/** 기본 데이터 + 내가 고친 것 = 엔진이 쓰는 데이터 */
export function applyUserData(base: EngineData, ud: UserData): EngineData {
  const hidden = new Set(ud.hidden)
  const places = base.places
    .filter((p) => !hidden.has(p.id))
    .map((p) => {
      const e = ud.edits[p.id]
      if (!e) return p
      const region = deriveRegion(e)
      return {
        ...p,
        lat: e.lat,
        lng: e.lng,
        address: e.address ?? p.address,
        coordsApprox: false,
        area: region.area,
        // 갈 수 있는 날: 지역이 같으면 조사한 날짜를 유지하고, 지역이 바뀌었거나 비어 있으면 지역 기준으로 다시 정한다
        availableDates:
          p.availableDates.length > 0 && p.area.slice(0, 2) === region.area.slice(0, 2) ? p.availableDates : region.dates,
        needsCheck: p.needsCheck.filter((x) => !['coords', 'address', 'area', 'branch'].includes(x)),
      }
    })
  return { ...base, places }
}
