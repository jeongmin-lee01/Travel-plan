import type { ReactNode } from 'react'
import { LockIcon } from './Icons'

/** 일반 카드 */
export function Card({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <div className={`rounded-card bg-card p-4 shadow-card ${className}`}>{children}</div>
}

/** 일정 카드: 왼쪽에 시각, 점선 절취선, 오른쪽에 내용 */
export function Ticket({
  time,
  until,
  locked,
  children,
}: {
  time: string
  until?: string
  locked?: boolean
  children: ReactNode
}) {
  return (
    <div className="ticket-notch relative flex rounded-card bg-card shadow-card">
      <div className="flex w-22 shrink-0 flex-col items-center justify-center gap-1 py-4">
        <span className="font-display text-2xl leading-none">{time}</span>
        {until && <span className="text-[0.8125rem] text-ink-soft">~ {until}</span>}
        {locked && (
          <span className="text-ink" role="img" aria-label="고정 일정">
            <LockIcon />
          </span>
        )}
      </div>
      <div className="min-w-0 flex-1 border-l-2 border-dashed border-line p-4">{children}</div>
    </div>
  )
}
