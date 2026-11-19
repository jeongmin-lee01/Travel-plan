import type { DateStr } from '../types'
import type { PlanApi } from '../store/usePlan'
import CandidateList from '../components/CandidateList'
import DayTabs from '../components/DayTabs'
import PageHeader from '../components/PageHeader'

/** 가운데 탭: 후보 체크리스트. 체크하면 동선에 들어가고 순서가 자동으로 정리된다 */
export default function CandidatePage({ api, activeDate, onDateChange, onSettings }: { api: PlanApi; onSettings: () => void; activeDate: DateStr; onDateChange: (d: DateStr) => void }) {
  const { data } = api
  const day = data.itinerary.days.find((d) => d.date === activeDate)!
  return (
    <>
      <PageHeader onSettings={onSettings} title="후보" sub="체크하면 동선에 들어가고 순서가 자동으로 정리돼요" />
      <DayTabs data={data} activeDate={activeDate} onChange={onDateChange} />
      <CandidateList data={data} api={api} activeDay={day} />
    </>
  )
}
