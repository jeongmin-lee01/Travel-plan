import { useMemo, useState } from 'react'
import TabBar, { type Tab } from './components/TabBar'
import ToastView from './components/ToastView'
import CandidatePage from './pages/CandidatePage'
import CheckPage from './pages/CheckPage'
import DesignPreview from './pages/DesignPreview'
import RoutePage from './pages/RoutePage'
import { collectChecks } from './lib/checks'
import type { DateStr } from './types'
import { usePlan } from './store/usePlan'

export default function App() {
  const [tab, setTab] = useState<Tab>('route')
  const api = usePlan()
  // 동선 탭과 후보 탭이 같은 날짜를 보도록 여기서 들고 있는다
  const [activeDate, setActiveDate] = useState<DateStr>(api.data.itinerary.days[0].date)
  const checks = useMemo(() => collectChecks(api.data, api.plans), [api.data, api.plans])

  if (window.location.hash === '#design') return <DesignPreview />
  return (
    <div className="min-h-dvh pb-24">
      {tab === 'route' && <RoutePage api={api} activeDate={activeDate} onDateChange={setActiveDate} />}
      {tab === 'candidates' && <CandidatePage api={api} activeDate={activeDate} onDateChange={setActiveDate} />}
      {tab === 'checks' && <CheckPage items={checks} />}
      <ToastView toast={api.toast} onUndo={api.undo} onClose={api.dismissToast} />
      <TabBar tab={tab} onChange={setTab} badges={{ checks: checks.length }} />
    </div>
  )
}
