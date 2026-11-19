import type { ReactNode } from 'react'
import { BagIcon, RouteIcon, TicketIcon } from './Icons'

export type Tab = 'route' | 'wishlist' | 'coupon'

const TABS: { id: Tab; label: string; icon: ReactNode }[] = [
  { id: 'route', label: '동선', icon: <RouteIcon /> },
  { id: 'wishlist', label: '위시리스트', icon: <BagIcon /> },
  { id: 'coupon', label: '쿠폰', icon: <TicketIcon /> },
]

export default function TabBar({ tab, onChange }: { tab: Tab; onChange: (t: Tab) => void }) {
  return (
    <nav
      aria-label="주 메뉴"
      className="fixed inset-x-0 bottom-0 z-20 flex border-t-2 border-line bg-card px-2 pt-2 pb-[max(0.5rem,env(safe-area-inset-bottom))]"
    >
      {TABS.map((t) => {
        const active = tab === t.id
        return (
          <button
            key={t.id}
            onClick={() => onChange(t.id)}
            aria-current={active ? 'page' : undefined}
            className="flex min-h-14 flex-1 flex-col items-center justify-center gap-0.5"
          >
            <span
              className={`flex h-8 w-16 items-center justify-center rounded-full transition-colors ${
                active ? 'bg-accent text-ink' : 'text-ink-soft'
              }`}
            >
              {t.icon}
            </span>
            <span className={`text-[0.8125rem] ${active ? 'font-display text-ink' : 'text-ink-soft'}`}>
              {t.label}
            </span>
          </button>
        )
      })}
    </nav>
  )
}
