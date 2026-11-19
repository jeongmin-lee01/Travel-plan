import type { EngineData, Place, TransitOption, TravelLeg } from '../types'

/**
 * 이동시간 제공자. 지금은 외부 API 없이 추정한다.
 * 나중에 Google Directions API 키를 쓰려면 같은 시그니처(TravelFn)로 바꿔 끼우면 된다.
 */
export type TravelFn = (a: Place, b: Place) => TravelLeg

export type City = 'kix' | 'usj' | 'osaka' | 'kyoto'

export function cityOf(p: Place): City {
  if (p.id === 'kix') return 'kix'
  if (p.id === 'usj') return 'usj'
  return p.area.startsWith('교토') ? 'kyoto' : 'osaka'
}

function kyotoZone(p: Place): 'kyoto-station' | 'kyoto-kawaramachi' {
  return p.id === 'kyoto-station' || p.area.includes('교토역') ? 'kyoto-station' : 'kyoto-kawaramachi'
}

/**
 * 오사카메트로 운임(2023-04 개정, 거리별 5구간): 3km 이하 190엔 / 7km 이하 240 / 13km 이하 290 / 19km 이하 340 / 그 이상 390.
 * 거리는 직선 거리 × 굴곡계수로 근사한 값이라 구간 경계에서는 실제와 한 구간 차이가 날 수 있다.
 */
function osakaMetroFare(meters: number): number {
  const km = meters / 1000
  return km <= 3 ? 190 : km <= 7 ? 240 : km <= 13 ? 290 : km <= 19 ? 340 : 390
}

/** 교토 시영 지하철 최저 운임(교토 시내 이동). 시버스 균일 운임은 230엔 */
const KYOTO_LOCAL_FARE = 220

/** 숙소(오사카)와 이어지는 장거리 노선 id. 오사카 장소는 null */
function hubRouteId(p: Place): string | null {
  switch (cityOf(p)) {
    case 'kix':
      return 'kix-osaka'
    case 'usj':
      return 'usj-osaka'
    case 'kyoto':
      return `osaka-${kyotoZone(p)}`
    default:
      return null
  }
}

function haversineM(a: Place, b: Place): number {
  const R = 6371000
  const rad = (d: number) => (d * Math.PI) / 180
  const dLat = rad(b.lat! - a.lat!)
  const dLng = rad(b.lng! - a.lng!)
  const h =
    Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat!)) * Math.cos(rad(b.lat!)) * Math.sin(dLng / 2) ** 2
  return 2 * R * Math.asin(Math.sqrt(h))
}

export function mapsDirUrl(a: Place, b: Place): string {
  return `https://www.google.com/maps/dir/?api=1&origin=${a.lat},${a.lng}&destination=${b.lat},${b.lng}&travelmode=transit`
}

/** routeChoice: 노선 id → 선택한 옵션 id. 없으면 가장 빠른 옵션 */
export function makeTravel(data: EngineData, routeChoice: Record<string, string> = {}): TravelFn {
  const routes = new Map(data.transit.routes.map((r) => [r.id, r]))
  const d = data.itinerary.defaults
  const cache = new Map<string, TravelLeg>()

  const pick = (routeId: string): TransitOption => {
    const route = routes.get(routeId)
    if (!route) throw new Error(`transit.json에 노선이 없어요: ${routeId}`)
    return (
      route.options.find((o) => o.id === routeChoice[routeId]) ??
      route.options.reduce((m, o) => (o.minutes < m.minutes ? o : m))
    )
  }

  const compute = (a: Place, b: Place): TravelLeg => {
    if (a.lat === null || a.lng === null || b.lat === null || b.lng === null) {
      throw new Error(`좌표가 없는 장소는 이동시간을 계산할 수 없어요: ${a.id} → ${b.id}`)
    }
    const url = mapsDirUrl(a, b)
    if (a.id === b.id) {
      return { mode: 'walk', minutes: 0, fareYen: 0, steps: 0, estimated: false, mapsUrl: url }
    }
    if (cityOf(a) !== cityOf(b)) {
      const options = [hubRouteId(a), hubRouteId(b)].filter((x): x is string => x !== null).map(pick)
      const minutes = options.reduce((s, o) => s + o.minutes, 0)
      return {
        mode: 'longhaul',
        minutes,
        fareYen: options.reduce((s, o) => s + o.fareYen, 0),
        steps: options.reduce((s, o) => s + o.walkMinutes, 0) * d.stepsPerWalkMin,
        estimated: options.some((o) => o.estimated),
        mapsUrl: url,
        detail: options.map((o) => o.name).join(' → '),
      }
    }
    const meters = haversineM(a, b) * d.detourFactor
    const walkMin = Math.ceil(meters / d.walkMetersPerMin)
    // 전철: 대기·승하차 8분 + 시속 30km
    const trainMin = Math.ceil(8 + meters / 500)
    // 걷는 쪽이 전철보다 9분 이내로만 더 걸리면 걷는다(요금·환승을 아끼므로). 약 1.6km까지가 이에 해당
    if (meters <= d.walkMaxMeters || walkMin <= trainMin + 9) {
      return { mode: 'walk', minutes: walkMin, fareYen: 0, steps: walkMin * d.stepsPerWalkMin, estimated: true, mapsUrl: url }
    }
    const minutes = trainMin
    const fareYen = cityOf(a) === 'kyoto' ? KYOTO_LOCAL_FARE : osakaMetroFare(meters)
    return { mode: 'train', minutes, fareYen, steps: d.stepsPerTrainLeg, estimated: true, mapsUrl: url }
  }

  return (a, b) => {
    const key = `${a.id}|${b.id}`
    let leg = cache.get(key)
    if (!leg) {
      leg = compute(a, b)
      cache.set(key, leg)
    }
    return leg
  }
}
