export type Tab = 'route' | 'wishlist' | 'coupon'

const TABS: { id: Tab; label: string; icon: string }[] = [
  { id: 'route', label: '동선', icon: '🗺️' },
  { id: 'wishlist', label: '위시리스트', icon: '🛍️' },
  { id: 'coupon', label: '쿠폰', icon: '🎫' },
]

export default function TabBar({ tab, onChange }: { tab: Tab; onChange: (t: Tab) => void }) {
  return (
    <nav className="fixed inset-x-0 bottom-0 flex border-t border-gray-200 bg-white pb-[env(safe-area-inset-bottom)]">
      {TABS.map((t) => (
        <button
          key={t.id}
          onClick={() => onChange(t.id)}
          className={`flex flex-1 flex-col items-center gap-0.5 py-2 text-xs ${
            tab === t.id ? 'font-bold text-blue-600' : 'text-gray-500'
          }`}
        >
          <span className="text-xl">{t.icon}</span>
          {t.label}
        </button>
      ))}
    </nav>
  )
}
