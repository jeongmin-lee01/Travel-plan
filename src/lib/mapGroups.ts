import type { DayConfig, DayPlan, EngineData, PlanState } from '../types'

export interface MapPoint {
  id: string
  lat: number
  lng: number
  kind: 'fixed' | 'route' | 'candidate'
  n?: number
  label: string
}

export interface MapGroup {
  key: string
  label: string
  points: MapPoint[]
}

/** 지역(area) 태그별로 지도 하나씩. 번호는 그날 방문 순서 전체 기준 */
export function buildMapGroups(
  data: EngineData,
  day: DayConfig,
  plan: DayPlan,
  state: PlanState,
  showCandidates: boolean,
): MapGroup[] {
  const byId = new Map(data.places.map((p) => [p.id, p]))
  const groups = new Map<string, MapGroup>()
  const add = (area: string, point: MapPoint) => {
    const g = groups.get(area) ?? { key: area, label: area, points: [] }
    g.points.push(point)
    groups.set(area, g)
  }

  const fixedIds = new Set(day.fixed.map((f) => f.placeId))
  if (day.freeWindow) {
    fixedIds.add(day.freeWindow.startPlaceId)
    fixedIds.add(day.freeWindow.endPlaceId)
  }
  const routeStops = plan.schedule.stops.filter((s) => s.kind === 'place')
  routeStops.forEach((s, i) => {
    const p = byId.get(s.placeId!)
    if (p?.lat != null && p.lng != null) add(p.area, { id: p.id, lat: p.lat, lng: p.lng, kind: 'route', n: i + 1, label: p.name.ko })
  })
  for (const id of fixedIds) {
    const p = byId.get(id)
    if (p?.lat != null && p.lng != null) add(p.area, { id: p.id, lat: p.lat, lng: p.lng, kind: 'fixed', label: p.name.ko })
  }
  if (showCandidates) {
    for (const p of data.places) {
      if (p.type !== 'candidate' || state.checked[p.id] || p.lat === null || p.lng === null) continue
      if (!p.availableDates.includes(day.date)) continue
      add(p.area, { id: p.id, lat: p.lat, lng: p.lng, kind: 'candidate', label: p.name.ko })
    }
  }

  // 방문 지점이나 후보가 하나도 없는 지역(고정 장소만 있는 곳)은 지도를 만들지 않는다
  const firstSeen = (g: MapGroup) => {
    const n = g.points.filter((p) => p.kind === 'route').map((p) => p.n!)
    return n.length ? Math.min(...n) : Infinity
  }
  return [...groups.values()]
    .filter((g) => g.points.some((p) => p.kind !== 'fixed'))
    .sort((a, b) => firstSeen(a) - firstSeen(b))
}

/** 구글맵 길찾기 링크: 숙소에서 출발해 방문 순서대로 경유하는 대중교통 경로(마지막 장소가 도착지) */
export function googleRouteUrl(data: EngineData, day: DayConfig, plan: DayPlan): string | null {
  if (!day.freeWindow) return null
  const byId = new Map(data.places.map((p) => [p.id, p]))
  const home = byId.get(day.freeWindow.startPlaceId)
  if (!home || home.lat === null) return null
  const stops = plan.schedule.stops
    .filter((s) => s.kind === 'place')
    .map((s) => byId.get(s.placeId!)!)
    .filter((p) => p.lat !== null && p.lng !== null)
  if (stops.length === 0) return null
  const pt = (p: { lat: number | null; lng: number | null }) => `${p.lat},${p.lng}`
  const waypoints = stops.slice(0, -1).map(pt).join('|')
  const last = stops[stops.length - 1]
  const params = new URLSearchParams({ api: '1', origin: pt(home), destination: pt(last), travelmode: 'transit' })
  if (waypoints) params.set('waypoints', waypoints)
  return `https://www.google.com/maps/dir/?${params.toString()}`
}
