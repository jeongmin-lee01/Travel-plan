import { useEffect, useRef, useState } from 'react'
import type { Place } from '../types'
import { deriveRegion, parseMapsLink, searchPlaces, type LatLng, type SearchResult } from '../lib/geo'
import Button from './Button'
import { Card } from './Card'
import Chip from './Chip'
import Input from './Input'
import PickMap from './PickMap'
import Sheet from './Sheet'

type Method = 'search' | 'link' | 'map'

interface Picked extends LatLng {
  address?: string
}

const KYOTO_CENTER: LatLng = { lat: 35.0036, lng: 135.7685 }
const OSAKA_CENTER: LatLng = { lat: 34.6724, lng: 135.5013 }

/** 후보의 위치를 지정·수정한다: 이름 검색 / 구글맵 링크 / 지도에서 직접 */
export default function LocationSheet({
  place,
  onClose,
  onSave,
}: {
  place: Place
  onClose: () => void
  onSave: (loc: { lat: number; lng: number; address?: string }) => void
}) {
  const [method, setMethod] = useState<Method>('search')
  const [query, setQuery] = useState(place.name.ja)
  const [results, setResults] = useState<SearchResult[]>([])
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState('')
  const [link, setLink] = useState('')
  const [picked, setPicked] = useState<Picked | null>(null)
  const abortRef = useRef<AbortController | null>(null)

  useEffect(() => () => abortRef.current?.abort(), [])

  const hasCoords = place.lat !== null && place.lng !== null
  const mapCenter: LatLng = hasCoords
    ? { lat: place.lat!, lng: place.lng! }
    : place.area.startsWith('오사카')
      ? OSAKA_CENTER
      : KYOTO_CENTER

  const runSearch = async () => {
    if (!query.trim()) return
    abortRef.current?.abort()
    const ctl = new AbortController()
    abortRef.current = ctl
    setLoading(true)
    setMessage('')
    try {
      const r = await searchPlaces(query.trim(), ctl.signal)
      setResults(r)
      if (r.length === 0) setMessage('검색 결과가 없어요. 일본어 이름이나 주소로 다시 검색하거나 다른 방법을 써 보세요')
    } catch (e) {
      if ((e as Error).name !== 'AbortError') {
        setMessage('검색하지 못했어요. 인터넷 연결을 확인하거나 구글맵 링크·지도 방법을 써 주세요')
      }
    } finally {
      setLoading(false)
    }
  }

  const applyLink = () => {
    const r = parseMapsLink(link)
    if (r.ok) {
      setPicked({ lat: r.lat, lng: r.lng })
      setMessage('')
    } else {
      setMessage(r.reason)
    }
  }

  const region = picked ? deriveRegion(picked) : null
  const gmaps = (p: LatLng) => `https://www.google.com/maps/search/?api=1&query=${p.lat},${p.lng}`

  return (
    <Sheet open title={`${place.name.ko} 위치`} onClose={onClose}>
      {hasCoords && (
        <p className="mb-3 text-base text-ink-soft">
          지금 위치{place.coordsApprox ? '(대략값, 정확하지 않을 수 있어요)' : ''}:{' '}
          <a href={gmaps({ lat: place.lat!, lng: place.lng! })} target="_blank" rel="noreferrer" className="text-accent-deep underline underline-offset-4">
            구글맵에서 보기
          </a>
        </p>
      )}
      <div className="mb-3 flex gap-2 overflow-x-auto">
        <Chip active={method === 'search'} onClick={() => setMethod('search')}>이름으로 검색</Chip>
        <Chip active={method === 'link'} onClick={() => setMethod('link')}>구글맵 링크</Chip>
        <Chip active={method === 'map'} onClick={() => setMethod('map')}>지도에서 찍기</Chip>
      </div>

      {method === 'search' && (
        <div className="space-y-3">
          <Input label="장소 이름 (일본어나 주소가 잘 찾아져요)" value={query} onChange={(e) => setQuery(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && runSearch()} />
          <Button onClick={runSearch} disabled={loading} className="w-full">
            {loading ? '검색 중…' : '검색'}
          </Button>
          <ul className="space-y-2">
            {results.map((r, i) => (
              <li key={i}>
                <button
                  onClick={() => setPicked({ lat: r.lat, lng: r.lng, address: r.name })}
                  className="min-h-12 w-full rounded-2xl border-2 border-line bg-card px-4 py-2 text-left text-base"
                >
                  {r.name}
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}

      {method === 'link' && (
        <div className="space-y-3">
          <Input label="구글맵 주소(링크)를 붙여넣어 주세요" value={link} onChange={(e) => setLink(e.target.value)} placeholder="https://www.google.com/maps/place/…" />
          <p className="text-[0.875rem] text-ink-soft">
            구글맵에서 장소를 연 뒤 주소창의 긴 주소를 복사하세요. 앱의 "공유" 짧은 링크(maps.app.goo.gl)는 읽을 수 없어요.
          </p>
          <Button onClick={applyLink} className="w-full">
            링크에서 위치 읽기
          </Button>
        </div>
      )}

      {method === 'map' && (
        <div className="space-y-2">
          <p className="text-base text-ink-soft">지도를 눌러 위치를 정하세요. 확대하면 더 정확해요.</p>
          <PickMap center={mapCenter} value={picked} onPick={(p) => setPicked(p)} />
        </div>
      )}

      {message && <p className="mt-3 rounded-xl border-2 border-warn px-3 py-2 text-base">{message}</p>}

      {picked && region && (
        <Card className="mt-4 space-y-2">
          <p className="font-display text-lg">이 위치로 저장할까요?</p>
          <p className="text-base">
            {picked.address ?? `${picked.lat.toFixed(5)}, ${picked.lng.toFixed(5)}`}
          </p>
          <p className="text-base text-ink-soft">
            지역: {region.area.replace('-', ' · ')}
            {region.city === 'other' && ' — 오사카·교토 밖이라 동선에 넣을 수 없어요'}
          </p>
          <a href={gmaps(picked)} target="_blank" rel="noreferrer" className="inline-block text-base text-accent-deep underline underline-offset-4">
            구글맵에서 확인
          </a>
          <Button
            className="w-full"
            onClick={() => {
              onSave(picked)
              onClose()
            }}
          >
            이 위치로 저장
          </Button>
        </Card>
      )}
    </Sheet>
  )
}
