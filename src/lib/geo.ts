export interface LatLng {
  lat: number
  lng: number
}

export type LinkParse = { ok: true; lat: number; lng: number } | { ok: false; reason: string }

const inJapan = (lat: number, lng: number) => lat >= 24 && lat <= 46 && lng >= 122 && lng <= 146

/**
 * 구글맵 링크(또는 "위도, 경도" 글자)에서 좌표를 뽑는다.
 * 짧은 링크(maps.app.goo.gl)는 브라우저에서 열어야 좌표가 드러나므로 읽을 수 없다.
 */
export function parseMapsLink(input: string): LinkParse {
  const text = input.trim()
  if (!text) return { ok: false, reason: '링크를 붙여넣어 주세요' }
  if (/maps\.app\.goo\.gl|goo\.gl\/maps/.test(text)) {
    return { ok: false, reason: '짧은 링크는 읽을 수 없어요. 브라우저에서 링크를 연 뒤, 주소창에 나온 긴 주소를 복사해 붙여넣어 주세요' }
  }
  const patterns = [
    /@(-?\d+\.\d+),(-?\d+\.\d+)/, // .../@34.67,135.50,17z
    /!3d(-?\d+\.\d+)!4d(-?\d+\.\d+)/, // 장소 핀 좌표
    /[?&](?:q|ll|query|destination|center)=(-?\d+\.\d+)(?:,|%2C)(-?\d+\.\d+)/, // ?q=34.67,135.50
    /^\s*(-?\d+\.\d+)\s*[,\s]\s*(-?\d+\.\d+)\s*$/, // "34.67, 135.50"
  ]
  for (const re of patterns) {
    const m = re.exec(text)
    if (!m) continue
    const lat = Number(m[1])
    const lng = Number(m[2])
    if (inJapan(lat, lng)) return { ok: true, lat, lng }
    return { ok: false, reason: '일본 밖 좌표예요. 링크를 다시 확인해 주세요' }
  }
  return { ok: false, reason: '링크에서 좌표를 찾지 못했어요. 구글맵에서 장소를 연 뒤 주소창의 긴 주소를 붙여넣어 주세요' }
}

export interface SearchResult extends LatLng {
  name: string
}

/** OpenStreetMap Nominatim 검색(API 키 없음, 인터넷 필요) */
export async function searchPlaces(query: string, signal?: AbortSignal): Promise<SearchResult[]> {
  const params = new URLSearchParams({ format: 'jsonv2', q: query, countrycodes: 'jp', limit: '6', 'accept-language': 'ja,ko' })
  const res = await fetch(`https://nominatim.openstreetmap.org/search?${params.toString()}`, { signal })
  if (!res.ok) throw new Error(`검색에 실패했어요 (${res.status})`)
  const rows = (await res.json()) as { display_name: string; lat: string; lon: string }[]
  return rows.map((r) => ({ name: r.display_name, lat: Number(r.lat), lng: Number(r.lon) }))
}

export function distM(a: LatLng, b: LatLng): number {
  const R = 6371000
  const rad = (d: number) => (d * Math.PI) / 180
  const dLat = rad(b.lat - a.lat)
  const dLng = rad(b.lng - a.lng)
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2
  return 2 * R * Math.asin(Math.sqrt(h))
}

const KYOTO_STATION: LatLng = { lat: 34.9858, lng: 135.7588 }
const NIPPONBASHI: LatLng = { lat: 34.66, lng: 135.507 }

export interface Region {
  city: 'osaka' | 'kyoto' | 'other'
  area: string
  /** 후보를 넣을 수 있는 날(오사카=Day1·4, 교토=Day2) */
  dates: string[]
}

/** 좌표로 지역 태그와 갈 수 있는 날을 정한다 */
export function deriveRegion(p: LatLng): Region {
  if (p.lat >= 34.85 && p.lat <= 35.15 && p.lng >= 135.6 && p.lng <= 135.9) {
    return {
      city: 'kyoto',
      area: distM(p, KYOTO_STATION) < 1500 ? '교토-교토역 주변' : '교토-가와라마치/시조',
      dates: ['2026-11-24'],
    }
  }
  if (p.lat >= 34.55 && p.lat <= 34.8 && p.lng >= 135.4 && p.lng <= 135.6) {
    return {
      city: 'osaka',
      area: distM(p, NIPPONBASHI) < 800 ? '오사카-닛폰바시' : '오사카-신사이바시/난바',
      dates: ['2026-11-23', '2026-11-26'],
    }
  }
  return { city: 'other', area: '기타(오사카·교토 밖)', dates: [] }
}
