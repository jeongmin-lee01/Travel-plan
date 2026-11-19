import { useEffect, useRef } from 'react'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import type { LatLng } from '../lib/geo'

/** 지도를 눌러 위치를 고르는 지도. 고른 위치에 주황 핀이 꽂힌다 */
export default function PickMap({
  center,
  value,
  onPick,
}: {
  center: LatLng
  value: LatLng | null
  onPick: (p: LatLng) => void
}) {
  const ref = useRef<HTMLDivElement>(null)
  const mapRef = useRef<L.Map | null>(null)
  const markerRef = useRef<L.Marker | null>(null)
  const onPickRef = useRef(onPick)
  onPickRef.current = onPick

  useEffect(() => {
    const el = ref.current
    if (!el) return
    const map = L.map(el, { dragging: !L.Browser.mobile, scrollWheelZoom: false }).setView([center.lat, center.lng], 16)
    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19, attribution: '© OpenStreetMap' }).addTo(map)
    map.on('click', (e: L.LeafletMouseEvent) => onPickRef.current({ lat: e.latlng.lat, lng: e.latlng.lng }))
    mapRef.current = map
    return () => {
      map.remove()
      mapRef.current = null
      markerRef.current = null
    }
    // 지도는 한 번만 만들고, 위치는 아래 effect에서 갱신한다
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    const map = mapRef.current
    if (!map || !value) return
    const icon = L.divIcon({
      className: '',
      html: '<span class="font-display flex h-9 w-9 items-center justify-center rounded-full border-2 border-ink bg-accent text-lg text-ink">★</span>',
      iconSize: [36, 36],
      iconAnchor: [18, 18],
    })
    if (markerRef.current) markerRef.current.setLatLng([value.lat, value.lng])
    else markerRef.current = L.marker([value.lat, value.lng], { icon }).addTo(map)
    map.panTo([value.lat, value.lng])
  }, [value])

  return (
    <div
      ref={ref}
      role="img"
      aria-label="위치를 고르는 지도"
      className="h-64 w-full overflow-hidden rounded-card border-2 border-line"
    />
  )
}
