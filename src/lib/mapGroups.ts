import type { DayConfig, DayPlan, EngineData, Place, PlanState } from '../types'
import { entryKey, toMin } from '../engine'
import { distM } from './geo'

export interface MapPoint {
  id: string
  lat: number
  lng: number
  kind: 'fixed' | 'route' | 'candidate'
  n?: number
  /** 숙소는 집 모양, 공항은 비행기 모양 아이콘 */
  icon?: 'home' | 'plane'
  label: string
}

export interface MapGroup {
  key: string
  label: string
  points: MapPoint[]
  /** 선으로 잇는 순서. 예) 입국일: 공항 → 숙소 → 1번 → … → n번 → 숙소 / 출국일: 숙소 → 1번 → … → 숙소 → 공항 */
  path: MapPoint[]
  /** 지도를 맞출 지점(숙소·공항이 너무 멀면 제외 = 가까이 보기) */
  fit: MapPoint[]
  /** 선이 지나는 모든 지점을 포함해 맞출 지점(전체 경로 보기) */
  fitAll: MapPoint[]
  /** 공항과 이어지는 날인가(입국일·출국일) */
  airport: boolean
  /** 오사카↔교토, 숙소↔공항처럼 먼 구간이 있는가(점선으로 그린다) */
  hasLongLeg: boolean
}

/** 이보다 먼 구간은 지도에서 점선으로 그린다 */
export const LONG_LEG_M = 15000
export const HOME_ID = 'hotel'
export const AIRPORT_ID = 'kix'

/**
 * 그날 지도 하나. 내가 체크한 1~n번 방문 지점을 번호 순서대로 숙소와 잇는다.
 * 입국일(Day 1)은 공항에서 숙소로, 출국일(Day 4)은 숙소에서 공항으로 이어진다.
 * 하루 종일 일정(USJ)인 날은 숙소 ↔ 고정 장소를 잇는다. 점 하나도 없으면 null.
 */
export function buildDayMap(
  data: EngineData,
  day: DayConfig,
  plan: DayPlan,
  state: PlanState,
  showCandidates: boolean,
): MapGroup | null {
  const byId = new Map(data.places.map((p) => [p.id, p]))
  const point = (p: Place | undefined, kind: MapPoint['kind'], n?: number): MapPoint | null =>
    p && p.lat !== null && p.lng !== null
      ? {
          id: p.id,
          lat: p.lat,
          lng: p.lng,
          kind,
          n,
          icon: p.id === HOME_ID ? 'home' : p.id === AIRPORT_ID ? 'plane' : undefined,
          label: p.name.ko,
        }
      : null
  const nonNull = (x: MapPoint | null): x is MapPoint => x !== null

  const fw = day.freeWindow
  const homeId = fw?.startPlaceId ?? HOME_ID
  const home = point(byId.get(homeId), 'fixed')
  const fixedIds = [...new Set(day.fixed.map((f) => f.placeId))].filter((id) => id !== homeId)
  const fixedPts = fixedIds.map((id) => point(byId.get(id), 'fixed')).filter(nonNull)
  const stopPts = plan.schedule.stops
    .map((s, i) => point(byId.get(s.placeId!), 'route', i + 1))
    .filter(nonNull)
  const candPts = showCandidates
    ? data.places
        .filter((p) => p.type === 'candidate' && !state.checked[entryKey(p.id, day.date)] && p.availableDates.includes(day.date))
        .map((p) => point(p, 'candidate'))
        .filter(nonNull)
    : []

  const points = [...(home ? [home] : []), ...fixedPts, ...stopPts, ...candPts]
  if (points.length === 0) return null

  // 공항: 그 날 일정 시작 전에 있으면 입국(공항 → 숙소), 끝난 뒤에 있으면 출국(숙소 → 공항)
  const airportFixed = day.fixed.find((f) => f.placeId === AIRPORT_ID)
  const airport = airportFixed && fw ? point(byId.get(AIRPORT_ID), 'fixed') : null
  const airportAtStart = !!airport && !!airportFixed?.at && !!fw && toMin(airportFixed.at) <= toMin(fw.start)

  let core: MapPoint[] = []
  if (home) {
    if (fw) core = stopPts.length > 0 ? [home, ...stopPts, home] : [home]
    else core = fixedPts.length > 0 ? [home, ...fixedPts, home] : []
  }
  let path = airport ? (airportAtStart ? [airport, ...core] : [...core, airport]) : core
  if (path.length < 2) path = []

  // 숙소·공항이 방문 지점들과 멀면 가까이 볼 때는 방문 지점에 맞추고, 그쪽으로 가는 선은 점선으로 지도 밖까지 이어진다
  let fit = points
  if (stopPts.length > 0) {
    const cLat = stopPts.reduce((s, p) => s + p.lat, 0) / stopPts.length
    const cLng = stopPts.reduce((s, p) => s + p.lng, 0) / stopPts.length
    const near = (p: MapPoint) => distM(p, { lat: cLat, lng: cLng }) <= LONG_LEG_M
    fit = [...stopPts, ...(home && near(home) ? [home] : []), ...candPts.filter(near)]
  }
  const fitAll = [...new Set([...fit, ...path])]

  const hasLongLeg = path.some((p, i) => i > 0 && distM(path[i - 1], p) > LONG_LEG_M)
  return { key: day.date, label: day.label, points, path, fit, fitAll, airport: !!airport && path.includes(airport), hasLongLeg }
}

/** 구글맵 길찾기 링크: 입국일은 공항에서 숙소로, 출국일은 숙소에서 공항으로 이어지고 방문 순서대로 경유하는 대중교통 경로 */
export function googleRouteUrl(data: EngineData, day: DayConfig, plan: DayPlan): string | null {
  const fw = day.freeWindow
  if (!fw) return null
  const byId = new Map(data.places.map((p) => [p.id, p]))
  const home = byId.get(fw.startPlaceId)
  if (!home || home.lat === null) return null
  const stops = plan.schedule.stops
    .map((s) => byId.get(s.placeId!))
    .filter((p): p is Place => !!p && p.lat !== null && p.lng !== null)

  const airportFixed = day.fixed.find((f) => f.placeId === AIRPORT_ID)
  const airport = airportFixed ? byId.get(AIRPORT_ID) : undefined
  const hasAirport = !!airport && airport.lat !== null
  if (stops.length === 0 && !hasAirport) return null

  const atStart = hasAirport && !!airportFixed?.at && toMin(airportFixed.at) <= toMin(fw.start)
  const stops2: Place[] = [...stops]
  let origin: Place = home
  let destination: Place = home
  let waypoints: Place[] = stops2
  if (hasAirport && atStart) {
    origin = airport!
    waypoints = [home, ...stops2]
  } else if (hasAirport) {
    destination = airport!
    waypoints = [...stops2, home]
  }

  const pt = (p: { lat: number | null; lng: number | null }) => `${p.lat},${p.lng}`
  const params = new URLSearchParams({ api: '1', origin: pt(origin), destination: pt(destination), travelmode: 'transit' })
  if (waypoints.length > 0) params.set('waypoints', waypoints.map(pt).join('|'))
  return `https://www.google.com/maps/dir/?${params.toString()}`
}
