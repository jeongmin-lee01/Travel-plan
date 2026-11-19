import { useEffect, useRef } from 'react'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import type { MapGroup } from '../lib/mapGroups'

const ICON_BASE = 'font-display flex h-9 w-9 items-center justify-center text-lg leading-none'

function markerHtml(kind: 'fixed' | 'route' | 'candidate', n?: number): string {
  if (kind === 'fixed') return `<span class="${ICON_BASE} rounded-lg bg-ink text-paper">★</span>`
  if (kind === 'route')
    return `<span class="${ICON_BASE} rounded-full border-2 border-ink bg-accent text-ink">${n}</span>`
  return `<span class="${ICON_BASE} rounded-full border-2 border-dashed border-ink-soft bg-card"></span>`
}

/** 지역 하나의 지도: 번호 마커 + 방문 순서대로 잇는 선(OpenStreetMap, API 키 없음) */
export default function RegionMap({ group }: { group: MapGroup }) {
  const ref = useRef<HTMLDivElement>(null)
  const signature = JSON.stringify(group.points)

  useEffect(() => {
    const el = ref.current
    if (!el) return
    // 휴대폰에서는 한 손가락 드래그를 페이지 스크롤에 양보하고, 확대·축소는 두 손가락/버튼으로
    const map = L.map(el, { dragging: !L.Browser.mobile, scrollWheelZoom: false })
    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '© OpenStreetMap',
    }).addTo(map)

    for (const p of group.points) {
      const icon = L.divIcon({ className: '', html: markerHtml(p.kind, p.n), iconSize: [36, 36], iconAnchor: [18, 18] })
      L.marker([p.lat, p.lng], { icon, title: p.label }).bindTooltip(p.label).addTo(map)
    }
    const route = group.points.filter((p) => p.kind === 'route').sort((a, b) => a.n! - b.n!)
    if (route.length > 1) {
      L.polyline(
        route.map((p) => [p.lat, p.lng] as [number, number]),
        { color: '#e0702b', weight: 4, opacity: 0.9 },
      ).addTo(map)
    }
    map.fitBounds(L.latLngBounds(group.points.map((p) => [p.lat, p.lng] as [number, number])), {
      padding: [32, 32],
      maxZoom: 16,
    })
    return () => {
      map.remove()
    }
    // group.points는 signature로 비교한다
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [signature])

  return (
    <div
      ref={ref}
      role="img"
      aria-label={`${group.label} 지도`}
      className="h-56 w-full overflow-hidden rounded-card border-2 border-line"
    />
  )
}
