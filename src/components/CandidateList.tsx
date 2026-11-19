import { useMemo, useState } from 'react'
import type { DateStr, DayConfig, EngineData, Place } from '../types'
import { cityOf, daysOf, defaultData, entryKey, parseHours, rankDays, toHHMM } from '../engine'
import { CATEGORIES } from '../lib/categories'
import { fmtDate } from '../lib/format'
import type { PlanApi } from '../store/usePlan'
import Badge from './Badge'
import Button from './Button'
import { Card } from './Card'
import Chip from './Chip'
import { isCustom } from '../store/userData'
import LocationSheet from './LocationSheet'
import AddCandidateSheet from './AddCandidateSheet'
import RestoreSheet from './RestoreSheet'

type CityFilter = 'all' | 'osaka' | 'kyoto'

function Checkbox({ checked, disabled, label, onClick }: { checked: boolean; disabled?: boolean; label: string; onClick: () => void }) {
  return (
    <button
      role="checkbox"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={onClick}
      className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border-2 text-2xl leading-none ${
        checked ? 'border-ink bg-accent text-ink' : 'border-ink-soft bg-card text-transparent'
      } ${disabled ? 'opacity-40' : ''}`}
    >
      ✓
    </button>
  )
}

function dayName(data: EngineData, date: DateStr): string {
  const d = data.itinerary.days.find((x) => x.date === date)
  return d ? `${d.label} ${fmtDate(d)}` : date
}

/**
 * 후보 체크리스트. 체크는 **위에서 고른 날짜(activeDay) 기준**이다.
 * 같은 후보를 여러 날에 체크할 수 있고, 막지 않고 주의 문구만 알려 준다.
 */
export default function CandidateList({ data, api, activeDay }: { data: EngineData; api: PlanApi; activeDay: DayConfig }) {
  const [city, setCity] = useState<CityFilter>('all')
  const [category, setCategory] = useState('')
  const [onlyToday, setOnlyToday] = useState(false)
  const [onlyUnchecked, setOnlyUnchecked] = useState(false)
  const [editing, setEditing] = useState<Place | null>(null)
  const [showRestore, setShowRestore] = useState(false)
  const [addingCandidate, setAddingCandidate] = useState(false)
  const hiddenPlaces = defaultData.places.filter((p) => api.userData.hidden.includes(p.id))

  const candidates = useMemo(() => data.places.filter((p) => p.type === 'candidate'), [data])
  const isOnActiveDay = (id: string) => !!api.state.checked[entryKey(id, activeDay.date)]
  const checkedToday = candidates.filter((p) => isOnActiveDay(p.id)).length

  /** 가장 잘 맞는 날. 갈 수 있는 날이 하나뿐이면 계산 없이 그날, 여러 날이면 엔진으로 비교 */
  const bestDay = useMemo(() => {
    const out = new Map<string, DateStr | undefined>()
    for (const p of candidates) {
      if (p.lat === null) continue
      const days = data.itinerary.days.filter((d) => d.freeWindow && p.availableDates.includes(d.date))
      if (days.length === 0) continue
      out.set(p.id, days.length === 1 ? days[0].date : rankDays(data, api.state, p.id).find((r) => r.feasible)?.day ?? days[0].date)
    }
    return out
  }, [candidates, data, api.state])

  const list = candidates.filter((p) => {
    if (city !== 'all' && cityOf(p) !== city) return false
    if (category && p.category !== category) return false
    if (onlyToday && !p.availableDates.includes(activeDay.date)) return false
    if (onlyUnchecked && isOnActiveDay(p.id)) return false
    return true
  })

  return (
    <section aria-label="후보 체크리스트" className="space-y-3 px-4">
      <p className="text-base text-ink-soft">
        <span className="font-bold text-ink">{activeDay.label}</span> 동선에 {checkedToday}곳 체크했어요 · 같은 곳을 여러 날에 체크해도 돼요
      </p>

      <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1">
        {(['all', 'osaka', 'kyoto'] as const).map((c) => (
          <Chip key={c} active={city === c} onClick={() => setCity(c)}>
            {c === 'all' ? '전체 지역' : c === 'osaka' ? '오사카' : '교토'}
          </Chip>
        ))}
        <Chip active={onlyToday} onClick={() => setOnlyToday((v) => !v)}>
          {activeDay.label}에 갈 수 있는 곳만
        </Chip>
        <Chip active={onlyUnchecked} onClick={() => setOnlyUnchecked((v) => !v)}>
          {activeDay.label}에 안 넣은 곳만
        </Chip>
        {hiddenPlaces.length > 0 && <Chip onClick={() => setShowRestore(true)}>제거한 후보 {hiddenPlaces.length}곳</Chip>}
      </div>
      <label className="block">
        <span className="sr-only">카테고리</span>
        <select
          value={category}
          onChange={(e) => setCategory(e.target.value)}
          className="min-h-12 w-full rounded-2xl border-2 border-line bg-card px-4 text-base"
        >
          <option value="">모든 카테고리</option>
          {CATEGORIES.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
      </label>

      <Button variant="secondary" className="w-full" onClick={() => setAddingCandidate(true)}>
        + 후보 추가
      </Button>

      {list.length === 0 && <p className="text-base text-ink-soft">조건에 맞는 후보가 없어요. 필터를 바꿔 보세요.</p>}

      <ul className="space-y-2">
        {list.map((p) => {
          const checked = isOnActiveDay(p.id)
          const otherDays = daysOf(api.state, p.id).filter((d) => d !== activeDay.date)
          const noCoords = p.lat === null || p.lng === null
          const availableToday = p.availableDates.includes(activeDay.date)
          const hrs = parseHours(p, activeDay.date)
          const best = bestDay.get(p.id)
          // 체크는 막지 않는다. 이 날 가기 어려운 곳이면 미리 알려 주기만 한다
          const heads = noCoords
            ? '위치를 지정하면 체크할 수 있어요'
            : !checked && !availableToday
              ? `${p.area.split('-')[0]} 지역이에요 · ${activeDay.label}에는 맞지 않을 수 있어요`
              : ''
          return (
            <li key={p.id}>
              <Card className="flex gap-3">
                <Checkbox
                  checked={checked}
                  disabled={noCoords}
                  label={`${p.name.ko} ${checked ? `${activeDay.label} 동선에서 빼기` : `${activeDay.label} 동선에 추가`}`}
                  onClick={() => api.toggleCandidate(p.id, activeDay.date)}
                />
                <div className="min-w-0 flex-1">
                  <p className="font-display text-lg leading-tight">{p.name.ko}</p>
                  <p className="text-[0.875rem] text-ink-soft">
                    {p.area.replace('-', ' · ')} · {p.category}
                    {p.categoryDetail && p.categoryDetail !== p.category && ` (${p.categoryDetail})`}
                  </p>
                  <p className="text-base">
                    {hrs ? `영업 ${toHHMM(hrs.open)}–${toHHMM(hrs.close)}` : `영업시간: ${p.hours.text ?? '확인 필요'}`}
                  </p>
                  <div className="mt-1 flex flex-wrap items-center gap-1.5">
                    {['필수', '권장'].includes(p.reservation.kind) && <Badge tone="reserve">예약 {p.reservation.kind}</Badge>}
                    {p.reservation.kind === '정리권·추첨' && <Badge tone="reserve">정리권·추첨</Badge>}
                    {p.needsCheck.includes('hours') && <Badge tone="note">시간 확인 필요</Badge>}
                    {p.chainGroup && <span className="text-[0.8125rem] text-ink-soft">같은 그룹: {p.chainGroup.toUpperCase()}</span>}
                  </div>
                  {checked && <p className="mt-1 text-base font-bold">{activeDay.label} 동선에 들어 있어요</p>}
                  {otherDays.length > 0 && (
                    <p className="mt-1 text-[0.875rem] text-ink-soft">
                      {otherDays.map((d) => dayName(data, d)).join(', ')}에도 들어 있어요
                    </p>
                  )}
                  {!checked && best && !heads && otherDays.length === 0 && (
                    <p className="mt-1 text-[0.875rem] text-ink-soft">가장 잘 맞는 날: {dayName(data, best)}</p>
                  )}
                  {heads && <p className="mt-1 text-[0.875rem] text-danger">{heads}</p>}
                  <div className="mt-1 flex flex-wrap gap-x-3">
                    <Button variant="ghost" className="px-0 text-base" onClick={() => setEditing(p)}>
                      {noCoords ? '위치 지정' : '위치 수정'}
                    </Button>
                    <Button variant="ghost" className="px-0 text-base" onClick={() => api.removeCandidate(p.id)}>
                      {isCustom(p.id) ? '삭제' : '목록에서 제거'}
                    </Button>
                  </div>
                </div>
              </Card>
            </li>
          )
        })}
      </ul>

      {editing && (
        <LocationSheet
          key={editing.id}
          place={editing}
          onClose={() => setEditing(null)}
          onSave={(loc) => api.setLocation(editing.id, loc)}
        />
      )}
      {addingCandidate && <AddCandidateSheet day={activeDay} onClose={() => setAddingCandidate(false)} onSave={api.addCandidate} />}
      <RestoreSheet
        open={showRestore}
        places={hiddenPlaces}
        onRestore={api.restoreCandidate}
        onClose={() => setShowRestore(false)}
      />
    </section>
  )
}
