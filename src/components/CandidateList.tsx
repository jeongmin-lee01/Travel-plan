import { useMemo, useState } from 'react'
import type { DateStr, DayConfig, EngineData, Place } from '../types'
import { cityOf, parseHours, rankDays, toHHMM } from '../engine'
import { fmtDate } from '../lib/format'
import type { PlanApi } from '../store/usePlan'
import Badge from './Badge'
import { Card } from './Card'
import Chip from './Chip'

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

export default function CandidateList({ data, api, activeDay, onAdded }: { data: EngineData; api: PlanApi; activeDay: DayConfig; onAdded: (date: DateStr) => void }) {
  const [city, setCity] = useState<CityFilter>('all')
  const [category, setCategory] = useState('')
  const [onlyToday, setOnlyToday] = useState(true)
  const [onlyUnchecked, setOnlyUnchecked] = useState(false)

  const candidates = useMemo(() => data.places.filter((p) => p.type === 'candidate'), [data])
  const categories = useMemo(() => [...new Set(candidates.map((p) => p.category))], [candidates])
  const checkedCount = candidates.filter((p) => api.state.checked[p.id]).length

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
    if (onlyUnchecked && api.state.checked[p.id]) return false
    return true
  })

  const onToggle = (p: Place) => {
    const r = api.toggleCandidate(p.id, onlyToday ? { day: activeDay.date } : {})
    if (r.action === 'added' && r.day) onAdded(r.day)
  }

  return (
    <section aria-label="후보 체크리스트" className="space-y-3 px-4">
      <div>
        <h2 className="font-display text-2xl">후보 체크리스트</h2>
        <p className="text-base text-ink-soft">체크하면 동선에 들어가고 순서가 자동으로 정리돼요 · {checkedCount}/{candidates.length}곳 체크</p>
      </div>

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
          동선에 없는 곳만
        </Chip>
      </div>
      <label className="block">
        <span className="sr-only">카테고리</span>
        <select
          value={category}
          onChange={(e) => setCategory(e.target.value)}
          className="min-h-12 w-full rounded-2xl border-2 border-line bg-card px-4 text-base"
        >
          <option value="">모든 카테고리</option>
          {categories.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
      </label>

      {list.length === 0 && <p className="text-base text-ink-soft">조건에 맞는 후보가 없어요. 필터를 바꿔 보세요.</p>}

      <ul className="space-y-2">
        {list.map((p) => {
          const entry = api.state.checked[p.id]
          const checked = !!entry
          const noCoords = p.lat === null || p.lng === null
          const availableToday = p.availableDates.includes(activeDay.date)
          const blockedToday = !checked && !noCoords && !availableToday && onlyToday
          const disabled = !checked && (noCoords || blockedToday)
          const hrs = parseHours(p, activeDay.date)
          const best = bestDay.get(p.id)
          const reason = noCoords
            ? '위치를 확인한 뒤 추가할 수 있어요'
            : !checked && !availableToday
              ? `${activeDay.label}에는 갈 수 없어요 (휴무 또는 지역)`
              : ''
          return (
            <li key={p.id}>
              <Card className={`flex gap-3 ${disabled ? 'bg-paper-deep' : ''}`}>
                <Checkbox
                  checked={checked}
                  disabled={disabled}
                  label={`${p.name.ko} ${checked ? '동선에서 빼기' : '동선에 추가'}`}
                  onClick={() => onToggle(p)}
                />
                <div className={`min-w-0 flex-1 ${disabled ? 'text-ink-soft' : ''}`}>
                  <p className="font-display text-lg leading-tight">{p.name.ko}</p>
                  <p className="text-[0.875rem] text-ink-soft">
                    {p.area.replace('-', ' · ')} · {p.category}
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
                  {checked && (
                    <p className="mt-1 text-base font-bold">{dayName(data, entry.day)}에 들어 있어요</p>
                  )}
                  {!checked && best && !reason && (
                    <p className="mt-1 text-[0.875rem] text-ink-soft">가장 잘 맞는 날: {dayName(data, best)}</p>
                  )}
                  {reason && <p className="mt-1 text-[0.875rem] text-danger">{reason}</p>}
                </div>
              </Card>
            </li>
          )
        })}
      </ul>
    </section>
  )
}
