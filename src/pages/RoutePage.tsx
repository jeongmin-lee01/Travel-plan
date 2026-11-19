import type { DateStr } from '../types'
import { fmtDur, fmtNum } from '../lib/format'
import type { PlanApi } from '../store/usePlan'
import DayTabs from '../components/DayTabs'
import DayView from '../components/DayView'
import PageHeader from '../components/PageHeader'

/** 왼쪽 탭: 내가 체크한 후보로 짜인 날짜별 동선 */
export default function RoutePage({ api, activeDate, onDateChange }: { api: PlanApi; activeDate: DateStr; onDateChange: (d: DateStr) => void }) {
  const { data, plans } = api
  const day = data.itinerary.days.find((d) => d.date === activeDate)!
  const plan = plans.find((p) => p.date === activeDate)!

  const summary =
    plan.order.length === 0
      ? '비어 있어요'
      : `${plan.order.length}곳 · 이동 ${fmtDur(plan.schedule.totals.travelMin)} · ${fmtNum(plan.schedule.totals.steps)}보`

  return (
    <>
      <PageHeader title="동선" sub="11/23(월) ~ 11/26(목) · 오사카·교토" />
      <DayTabs data={data} activeDate={activeDate} onChange={onDateChange} />
      <p className="px-4 pb-3 text-base text-ink-soft">{day.freeWindow ? summary : '하루 종일 USJ예요. 후보는 넣지 않아요.'}</p>
      <DayView key={day.date} data={data} day={day} plan={plan} api={api} />
    </>
  )
}
