import { Fragment } from 'react'
import {
  closestCenter,
  DndContext,
  PointerSensor,
  TouchSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core'
import { arrayMove, SortableContext, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import type { DayConfig, DayPlan, EngineData, Place, StopPlan, TravelLeg } from '../types'
import { entryKey, makeTravel, parseHours, toHHMM, toMin } from '../engine'
import { fmtNum } from '../lib/format'
import type { PlanApi } from '../store/usePlan'
import Button from './Button'
import { Card, Ticket } from './Card'
import FlagBadges from './FlagBadges'
import { HomeIcon, PlaneIcon } from './Icons'
import MapMarker from './MapMarker'

/** buffer: 이동마다 더하는 여유 시간. 카드의 시각은 이동 + 여유가 합쳐진 값이다 */
function LegRow({ leg, buffer = 0 }: { leg: TravelLeg; buffer?: number }) {
  if (leg.minutes === 0) return null
  const label = leg.mode === 'walk' ? '도보' : leg.mode === 'train' ? '전철' : '장거리 이동'
  return (
    <div className="ml-10 border-l-2 border-dashed border-line py-2 pl-4 text-[0.875rem] text-ink-soft">
      <p>
        {label} {leg.minutes}분{buffer > 0 && ` + 여유 ${buffer}분`}{leg.fareYen > 0 && ` · ${fmtNum(leg.fareYen)}엔`}
        {leg.estimated && ' (추정)'}{' '}
        <a href={leg.mapsUrl} target="_blank" rel="noreferrer" className="text-accent-deep underline underline-offset-2">
          구글맵에서 확인
        </a>
      </p>
      {leg.detail && <p>{leg.detail}</p>}
    </div>
  )
}

function FixedCard({ item, place }: { item: DayConfig['fixed'][number]; place?: Place }) {
  const title = place?.name.ko ?? item.placeId
  const body = (
    <>
      <p className="font-display flex items-center gap-1.5 text-xl">
        {place?.id === 'hotel' && <HomeIcon />}
        {place?.id === 'kix' && <PlaneIcon />}
        {title}
      </p>
      <p className="text-base text-ink-soft">
        {item.role}
        {item.minutes ? ` · ${item.minutes}분` : ''}
        {item.estimated ? ' · 임시 시각' : ''}
      </p>
      {item.note && <p className="text-[0.875rem] text-ink-soft">{item.note}</p>}
    </>
  )
  if (!item.at) return <Card className="my-1">{body}</Card>
  return (
    <div className="my-1">
      <Ticket time={item.at} locked>
        {body}
      </Ticket>
    </div>
  )
}

function StopCard({
  n,
  stop,
  place,
  date,
  plan,
  api,
  pinned,
}: {
  n: number
  stop: StopPlan
  place: Place
  date: string
  plan: DayPlan
  api: PlanApi
  pinned: boolean
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: place.id })
  const entry = api.state.checked[entryKey(place.id, date)]
  const stay = entry?.stayMinutes ?? place.stayMinutes.value
  const hrs = parseHours(place, date)
  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.6 : 1, zIndex: isDragging ? 10 : undefined }}
      className="relative my-1"
    >
      <Ticket time={toHHMM(stop.start)} until={toHHMM(stop.end)} locked={pinned}>
        <div className="flex items-start gap-2">
          <MapMarker kind="route" n={n} />
          <div className="min-w-0 flex-1">
            <p className="font-display text-xl leading-tight">{place.name.ko}</p>
            <p className="text-[0.875rem] text-ink-soft">{place.area.replace('-', ' · ')}</p>
          </div>
          <button
            {...attributes}
            {...listeners}
            aria-label={`${place.name.ko} 순서 바꾸기 (끌어서 이동)`}
            style={{ touchAction: 'none' }}
            className="flex min-h-12 min-w-12 shrink-0 items-center justify-center rounded-xl border-2 border-line bg-card text-2xl text-ink-soft"
          >
            ≡
          </button>
        </div>
        <p className="mt-2 text-base">
          {hrs ? `영업 ${toHHMM(hrs.open)}–${toHHMM(hrs.close)}` : `영업시간: ${place.hours.text ?? '확인 필요'}`}
          {stop.waitMin > 0 && <span className="text-ink-soft"> · 오픈 대기 {stop.waitMin}분</span>}
        </p>
        <div className="mt-2 flex flex-wrap gap-1.5">
          <FlagBadges flags={plan.schedule.flags} place={place} />
        </div>
        <div className="mt-3 flex items-center gap-2">
          <span className="text-base">
            체류 {stay}분{!entry?.stayMinutes && place.stayMinutes.estimated && ' (추정)'}
          </span>
          <Button variant="secondary" className="min-w-12 px-0 text-base" aria-label="체류시간 10분 줄이기" onClick={() => api.setStay(place.id, date, Math.max(10, stay - 10))}>
            −10
          </Button>
          <Button variant="secondary" className="min-w-12 px-0 text-base" aria-label="체류시간 10분 늘리기" onClick={() => api.setStay(place.id, date, stay + 10)}>
            +10
          </Button>
        </div>
        <div className="mt-2 flex flex-wrap gap-2">
          <Button
            variant="secondary"
            className="text-base"
            aria-pressed={pinned}
            onClick={() => api.setPin(place.id, date, pinned ? undefined : stop.start)}
          >
            {pinned ? `🔒 ${toHHMM(stop.start)} 고정 해제` : '이 시각에 고정'}
          </Button>
          <Button variant="ghost" className="text-base" onClick={() => api.toggleCandidate(place.id, date)}>
            동선에서 빼기
          </Button>
        </div>
      </Ticket>
    </div>
  )
}

export default function RouteTimeline({ data, day, plan, api }: { data: EngineData; day: DayConfig; plan: DayPlan; api: PlanApi }) {
  const byId = new Map(data.places.map((p) => [p.id, p]))
  const travel = makeTravel(data)
  const bufferOf = (leg: TravelLeg) =>
    leg.minutes === 0 ? 0 : leg.mode === 'walk' ? data.itinerary.defaults.bufferWalkMin : data.itinerary.defaults.bufferTransitMin
  /** 고정 카드들. 서로 다른 장소로 이어지면 사이에 이동 구간(예: 공항 ↔ 숙소)을 보여준다 */
  const renderFixed = (list: DayConfig['fixed'], prefix: string) =>
    list.map((f, i) => {
      const place = byId.get(f.placeId)
      const prev = i > 0 ? byId.get(list[i - 1].placeId) : undefined
      const leg =
        prev && place && prev.id !== place.id && prev.lat !== null && place.lat !== null ? travel(prev, place) : null
      return (
        <Fragment key={`${prefix}${i}`}>
          {leg && <LegRow leg={leg} />}
          <FixedCard item={f} place={place} />
        </Fragment>
      )
    })
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 120, tolerance: 6 } }),
  )

  const fw = day.freeWindow
  const startMin = fw ? toMin(fw.start) : 0
  const before = day.fixed.filter((f) => !fw || !f.at || toMin(f.at) <= startMin)
  const after = day.fixed.filter((f) => fw && f.at && toMin(f.at) > startMin)

  const stops = plan.schedule.stops
  const placeStops = stops.filter((s) => s.kind === 'place')
  const ids = placeStops.map((s) => s.placeId!)

  const onDragEnd = (e: DragEndEvent) => {
    if (!e.over || e.active.id === e.over.id) return
    const from = ids.indexOf(String(e.active.id))
    const to = ids.indexOf(String(e.over.id))
    if (from < 0 || to < 0) return
    api.setOrder(day.date, arrayMove(ids, from, to))
  }

  return (
    <div>
      {renderFixed(before, 'b')}

      {placeStops.length > 0 && (
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
          <SortableContext items={ids} strategy={verticalListSortingStrategy}>
            {stops.map((s) => {
              const place = byId.get(s.placeId!)!
              const n = ids.indexOf(place.id) + 1
              return (
                <Fragment key={place.id}>
                  {s.travel && <LegRow leg={s.travel} buffer={bufferOf(s.travel)} />}
                  <StopCard
                    n={n}
                    stop={s}
                    place={place}
                    date={day.date}
                    plan={plan}
                    api={api}
                    pinned={api.state.checked[entryKey(place.id, day.date)]?.pinTime !== undefined}
                  />
                </Fragment>
              )
            })}
          </SortableContext>
        </DndContext>
      )}

      {placeStops.length > 0 && plan.schedule.returnTravel && (
        <>
          <LegRow leg={plan.schedule.returnTravel} buffer={bufferOf(plan.schedule.returnTravel)} />
          <Card className="my-1">
            <p className="font-display flex items-center gap-1.5 text-xl">
              {fw!.endPlaceId === 'hotel' && <HomeIcon />}
              {byId.get(fw!.endPlaceId)?.name.ko ?? '숙소'} 도착 {toHHMM(plan.schedule.endArrive)}
            </p>
          </Card>
        </>
      )}

      {renderFixed(after, 'a')}
    </div>
  )
}
