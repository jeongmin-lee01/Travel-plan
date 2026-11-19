import { useState } from 'react'
import TabBar, { type Tab } from './components/TabBar'
import ToastView from './components/ToastView'
import RoutePage from './pages/RoutePage'
import WishlistPage from './pages/WishlistPage'
import CouponPage from './pages/CouponPage'
import DesignPreview from './pages/DesignPreview'
import { usePlan } from './store/usePlan'

export default function App() {
  const [tab, setTab] = useState<Tab>('route')
  const api = usePlan()
  if (window.location.hash === '#design') return <DesignPreview />
  return (
    <div className="min-h-dvh pb-24">
      {tab === 'route' && <RoutePage api={api} />}
      {tab === 'wishlist' && <WishlistPage />}
      {tab === 'coupon' && <CouponPage />}
      <ToastView toast={api.toast} onUndo={api.undo} onClose={api.dismissToast} />
      <TabBar tab={tab} onChange={setTab} />
    </div>
  )
}
