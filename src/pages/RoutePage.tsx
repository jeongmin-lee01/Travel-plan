import { useMemo, useState } from 'react'
import type { DateStr } from '../types'
import { collectChecks } from '../lib/checks'
import { fmtDate, fmtDur, fmtNum } from '../lib/format'
import type { PlanApi } from '../store/usePlan'
import Button from '../components/Button'
import CandidateList from '../components/CandidateList'
import DayView from '../components/DayView'
import NeedsCheckSheet from '../components/NeedsCheckSheet'
import PageHeader from '../components/PageHeader'

export default function RoutePage({ api }: { api: PlanApi }) {
  const { data, plans } = api
  const [activeDate, setActiveDate] = useState<DateStr>(data.itinerary.days[0].date)
  const [needsOpen, setNeedsOpen] = useState(false)

  const day = data.itinerary.days.find((d) => d.date === activeDate)!
  const plan = plans.find((p) => p.date === activeDate)!
  const checks = useMemo(() => collectChecks(data, plans), [data, plans])

  const summary = (p: (typeof plans)[number]) =>
    p.order.length === 0
      ? '비어 있어요'
      : `${p.order.length}곳 · 이동 ${fmtDur(p.schedule.totals.travelMin)} · ${fmtNum(p.schedule.totals.steps)}보`

  return (
    <>
      <PageHeader title="동선" sub="11/23(월) ~ 11/26(목) · 오사카·교토" />

      <div className="px-4 pb-3">
        <Button variant="secondary" className="w-full" onClick={() => setNeedsOpen(true)}>
          확인·예약 필요 {checks.length}건 보기
        </Button>
      </div>

      <div role="tablist" aria-label="날짜" className="sticky top-0 z-10 flex gap-2 overflow-x-auto bg-paper px-4 pb-3 pt-1">
        {data.itinerary.days.map((d) => {
          const active = d.date === activeDate
          return (
            <button
              key={d.date}
              role="tab"
              aria-selected={active}
              onClick={() => setActiveDate(d.date)}
              className={`min-h-14 min-w-[5.5rem] flex-1 rounded-2xl border-2 px-2 py-1 text-center ${
                active ? 'border-ink bg-accent' : 'border-line bg-card'
              }`}
            >
              <span className="font-display block text-lg leading-tight">{d.label}</span>
              <span className="block text-[0.8125rem] leading-tight">{fmtDate(d)}</span>
            </button>
          )
        })}
      </div>

      <p className="px-4 pb-3 text-base text-ink-soft">
        {day.freeWindow ? summary(plan) : '하루 종일 USJ예요. 후보는 넣지 않아요.'}
      </p>

      <DayView key={day.date} data={data} day={day} plan={plan} api={api} />

      <div className="mt-8 border-t-2 border-dashed border-line pt-6">
        <CandidateList data={data} api={api} activeDay={day} onAdded={setActiveDate} />
      </div>

      <NeedsCheckSheet open={needsOpen} items={checks} onClose={() => setNeedsOpen(false)} />
    </>
  )
}
