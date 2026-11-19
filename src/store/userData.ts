import type { EngineData, Place } from '../types'
import { type Category, normalizeCategory } from '../lib/categories'
import { deriveRegion, parseMapsLink } from '../lib/geo'

/** 앱에 들어 있는 기본 데이터(places.json)는 건드리지 않고, 내가 고치거나 추가한 것만 따로 저장한다 */
export interface UserData {
  /** 후보 목록에서 제거(숨김)한 기본 장소 */
  hidden: string[]
  /** 내가 지정·수정한 위치(기본 장소와 직접 추가한 장소 모두) */
  edits: Record<string, { lat: number; lng: number; address?: string }>
  /** 내가 직접 추가한 장소(식당·쇼핑 등). 기본적으로 후보로 저장된다 */
  custom: Place[]
}

export const emptyUserData = (): UserData => ({ hidden: [], edits: {}, custom: [] })

export function sanitizeUserData(raw: unknown): UserData {
  const u = emptyUserData()
  if (!raw || typeof raw !== 'object') return u
  const { hidden, edits, custom } = raw as Partial<UserData>
  if (Array.isArray(hidden)) u.hidden = hidden.filter((x): x is string => typeof x === 'string')
  for (const [id, e] of Object.entries(edits ?? {})) {
    if (e && typeof e.lat === 'number' && typeof e.lng === 'number') u.edits[id] = e
  }
  if (Array.isArray(custom)) {
    u.custom = custom.filter((p) => p && typeof p.id === 'string' && p.type === 'candidate' && p.name && typeof p.name.ko === 'string')
  }
  return u
}

/** 기본 데이터 + 내가 고치고 추가한 것 = 엔진이 쓰는 데이터 */
export function applyUserData(base: EngineData, ud: UserData): EngineData {
  const hidden = new Set(ud.hidden)
  const places = [...base.places, ...ud.custom]
    .filter((p) => !hidden.has(p.id))
    // 후보 카테고리는 4가지로 묶고, 원래 세부 분류는 categoryDetail에 남긴다
    .map((p) => {
      if (p.type !== 'candidate') return p
      const category = normalizeCategory(p.category)
      return { ...p, category, categoryDetail: p.categoryDetail ?? (category !== p.category ? p.category : undefined) }
    })
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
        // 갈 수 있는 날: 지역이 같으면 기존 날짜를 유지하고, 지역이 바뀌었거나 비어 있으면 지역 기준으로 다시 정한다
        availableDates:
          p.availableDates.length > 0 && p.area.slice(0, 2) === region.area.slice(0, 2) ? p.availableDates : region.dates,
        needsCheck: p.needsCheck.filter((x) => !['coords', 'address', 'area', 'branch'].includes(x)),
      }
    })
  return { ...base, places }
}

export const isCustom = (id: string) => id.startsWith('custom-')

export interface NewCandidateInput {
  name: string
  /** 구글맵 링크(선택). 좌표를 읽어 위치로 쓴다 */
  mapsLink: string
  category: Category
  stayMinutes: number
  /** 영업시간(선택). 예: 11:00-15:00 */
  hours: string
  needsReservation: boolean
}

/** 입력값 → 후보 장소. 링크에서 좌표를 못 읽으면 위치 없이 만들고(나중에 위치 지정) 이유를 돌려준다 */
export function makeCandidate(input: NewCandidateInput, id: string): { place: Place; linkError?: string } {
  const link = input.mapsLink.trim()
  let lat: number | null = null
  let lng: number | null = null
  let linkError: string | undefined
  if (link) {
    const r = parseMapsLink(link)
    if (r.ok) {
      lat = r.lat
      lng = r.lng
    } else {
      linkError = r.reason
    }
  }
  const region = lat !== null && lng !== null ? deriveRegion({ lat, lng }) : null
  const hours = input.hours.trim()
  const name = input.name.trim()
  const place: Place = {
    id,
    type: 'candidate',
    name: { ko: name, ja: name },
    category: normalizeCategory(input.category),
    address: null,
    lat,
    lng,
    coordsApprox: false,
    nearestStation: '',
    area: region?.area ?? '확인 필요',
    availableDates: region?.dates ?? [],
    googleMapsUrl: link || `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(name)}`,
    hours: hours ? { text: hours } : {},
    lastEntry: null,
    closedDays: [],
    exceptions: [],
    reservation: { kind: input.needsReservation ? '필수' : '불필요', link: null, opensAt: null },
    myReservation: { time: null, code: null },
    stayMinutes: { value: input.stayMinutes, estimated: false },
    chainGroup: null,
    sources: [],
    needsCheck: [...(hours ? [] : ['hours']), ...(lat === null ? ['coords'] : [])],
    notes: '',
  }
  return { place, linkError }
}
