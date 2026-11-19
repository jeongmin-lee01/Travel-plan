import type { ReactNode } from 'react'
import { AlertIcon, ChecklistIcon, RouteIcon } from './Icons'

export type Tab = 'route' | 'candidates' | 'checks'

const TABS: { id: Tab; label: string; icon: ReactNode }[] = [
  { id: 'route', label: '동선', icon: <RouteIcon /> },
  { id: 'candidates', label: '후보', icon: <ChecklistIcon /> },
  { id: 'checks', label: '확인 필요', icon: <AlertIcon /> },
]

export default function TabBar({
  tab,
  onChange,
  badges = {},
}: {
  tab: Tab
  onChange: (t: Tab) => void
  /** 탭 아이콘 오른쪽 위에 보여줄 개수 */
  badges?: Partial<Record<Tab, number>>
}) {
  return (
    <nav
      aria-label="주 메뉴"
      className="fixed inset-x-0 bottom-0 z-20 flex border-t-2 border-line bg-card px-2 pt-2 pb-[max(0.5rem,env(safe-area-inset-bottom))]"
    >
      {TABS.map((t) => {
        const active = tab === t.id
        const badge = badges[t.id] ?? 0
        return (
          <button
            key={t.id}
            onClick={() => onChange(t.id)}
            aria-current={active ? 'page' : undefined}
            className="flex min-h-14 flex-1 flex-col items-center justify-center gap-0.5"
          >
            <span
              className={`relative flex h-8 w-16 items-center justify-center rounded-full transition-colors ${
                active ? 'bg-accent text-ink' : 'text-ink-soft'
              }`}
            >
              {t.icon}
              {badge > 0 && (
                <span
                  aria-label={`${badge}건`}
                  className="font-display absolute -top-1 right-0 flex h-5 min-w-5 items-center justify-center rounded-full bg-reserve px-1 text-[0.75rem] leading-none text-white"
                >
                  {badge}
                </span>
              )}
            </span>
            <span className={`text-[0.8125rem] ${active ? 'font-display text-ink' : 'text-ink-soft'}`}>{t.label}</span>
          </button>
        )
      })}
    </nav>
  )
}
