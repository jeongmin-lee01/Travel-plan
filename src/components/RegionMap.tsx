import { useEffect, useRef } from 'react'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import { distM } from '../lib/geo'
import { LONG_LEG_M, type MapGroup } from '../lib/mapGroups'

const ICON_BASE = 'font-display flex h-9 w-9 items-center justify-center text-lg leading-none'

/** 집 모양(숙소) */
const HOME_SVG =
  '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 11.5 12 4l9 7.5"/><path d="M5.5 10v9.5h13V10"/><path d="M10 19.5v-5h4v5"/></svg>'

/** 비행기(공항) */
const PLANE_SVG =
  '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M17.8 19.2 16 11l3.5-3.5C21 6 21.5 4 21 3c-1-.5-3 0-4.5 1.5L13 8 4.8 6.2c-.5-.1-.9.1-1.1.5l-.3.5c-.2.5-.1 1 .3 1.3L9 12l-2 3H4l-1 1 3 2 2 3 1-1v-3l3-2 3.5 5.3c.3.4.8.5 1.3.3l.5-.2c.4-.3.6-.7.5-1.2z"/></svg>'

function markerHtml(kind: 'fixed' | 'route' | 'candidate', n?: number, icon?: 'home' | 'plane'): string {
  if (icon === 'plane') return `<span class="${ICON_BASE} rounded-lg bg-ink text-paper">${PLANE_SVG}</span>`
  if (icon === 'home') return `<span class="${ICON_BASE} rounded-lg bg-ink text-paper">${HOME_SVG}</span>`
  if (kind === 'fixed') return `<span class="${ICON_BASE} rounded-lg bg-ink text-paper">★</span>`
  if (kind === 'route')
    return `<span class="${ICON_BASE} rounded-full border-2 border-ink bg-accent text-ink">${n}</span>`
  return `<span class="${ICON_BASE} rounded-full border-2 border-dashed border-ink-soft bg-card"></span>`
}

/** 두 지점 사이 진행 방향(북쪽 0도, 시계 방향) */
function bearing(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
  const rad = (d: number) => (d * Math.PI) / 180
  const dLng = rad(b.lng - a.lng)
  const y = Math.sin(dLng) * Math.cos(rad(b.lat))
  const x = Math.cos(rad(a.lat)) * Math.sin(rad(b.lat)) - Math.sin(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.cos(dLng)
  return ((Math.atan2(y, x) * 180) / Math.PI + 360) % 360
}

/**
 * 그날 지도: 숙소(집 아이콘) → 1번 → … → n번 → 숙소를 번호 순서대로 한 줄로 잇는다.
 * 구간마다 진행 방향 화살표가 있고, 먼 구간(오사카↔교토)은 점선이다. (OpenStreetMap, API 키 없음)
 */
export default function RegionMap({ group, showAll = false }: { group: MapGroup; showAll?: boolean }) {
  const ref = useRef<HTMLDivElement>(null)
  const signature = JSON.stringify([group.points, group.path, group.fit, group.fitAll, showAll])

  useEffect(() => {
    const el = ref.current
    if (!el) return
    // 휴대폰에서는 한 손가락 드래그를 페이지 스크롤에 양보하고, 확대·축소는 두 손가락/버튼으로
    const map = L.map(el, { dragging: !L.Browser.mobile, scrollWheelZoom: false })
    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '© OpenStreetMap',
    }).addTo(map)

    // 선과 화살표를 먼저 그리고, 마커를 그 위에 얹는다
    for (let i = 0; i < group.path.length - 1; i++) {
      const a = group.path[i]
      const b = group.path[i + 1]
      if (a.lat === b.lat && a.lng === b.lng) continue
      const seg: [number, number][] = [
        [a.lat, a.lng],
        [b.lat, b.lng],
      ]
      const long = distM(a, b) > LONG_LEG_M
      L.polyline(seg, { color: '#ffffff', weight: 9, opacity: 0.95 }).addTo(map)
      L.polyline(seg, { color: '#e0702b', weight: 5, opacity: 1, dashArray: long ? '10 12' : undefined }).addTo(map)
      const arrow = L.divIcon({
        className: '',
        html: `<span style="display:block;transform:rotate(${bearing(a, b)}deg);line-height:1" class="text-base text-ink">▲</span>`,
        iconSize: [16, 16],
        iconAnchor: [8, 8],
      })
      L.marker([(a.lat + b.lat) / 2, (a.lng + b.lng) / 2], { icon: arrow, interactive: false, keyboard: false }).addTo(map)
    }

    for (const p of group.points) {
      const icon = L.divIcon({ className: '', html: markerHtml(p.kind, p.n, p.icon), iconSize: [36, 36], iconAnchor: [18, 18] })
      L.marker([p.lat, p.lng], { icon, title: p.label, zIndexOffset: p.icon ? 1000 : 0 }).bindTooltip(p.label).addTo(map)
    }

    // 전체 경로 보기(공항·숙소까지) / 가까이 보기(방문 지점 위주)
    const target = showAll ? group.fitAll : group.fit
    const fit = target.length > 0 ? target : group.points
    map.fitBounds(L.latLngBounds(fit.map((p) => [p.lat, p.lng] as [number, number])), { padding: [36, 36], maxZoom: 16 })
    return () => {
      map.remove()
    }
    // group은 signature로 비교한다
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [signature])

  return (
    <div
      ref={ref}
      role="img"
      aria-label={`${group.label} 동선 지도`}
      className="isolate h-72 w-full overflow-hidden rounded-card border-2 border-line"
    />
  )
}
