import { useState } from 'react'
import TabBar, { type Tab } from './components/TabBar'
import RoutePage from './pages/RoutePage'
import WishlistPage from './pages/WishlistPage'
import CouponPage from './pages/CouponPage'
import DesignPreview from './pages/DesignPreview'

export default function App() {
  const [tab, setTab] = useState<Tab>('route')
  if (window.location.hash === '#design') return <DesignPreview />
  return (
    <div className="min-h-dvh pb-24">
      {tab === 'route' && <RoutePage />}
      {tab === 'wishlist' && <WishlistPage />}
      {tab === 'coupon' && <CouponPage />}
      <TabBar tab={tab} onChange={setTab} />
    </div>
  )
}
