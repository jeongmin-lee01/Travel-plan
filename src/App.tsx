import { useState } from 'react'
import TabBar, { type Tab } from './components/TabBar'
import RoutePage from './pages/RoutePage'
import WishlistPage from './pages/WishlistPage'
import CouponPage from './pages/CouponPage'

export default function App() {
  const [tab, setTab] = useState<Tab>('route')
  return (
    <div className="min-h-dvh bg-gray-50 pb-20">
      {tab === 'route' && <RoutePage />}
      {tab === 'wishlist' && <WishlistPage />}
      {tab === 'coupon' && <CouponPage />}
      <TabBar tab={tab} onChange={setTab} />
    </div>
  )
}
