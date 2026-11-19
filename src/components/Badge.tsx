import type { ReactNode } from 'react'

export type BadgeTone = 'closed' | 'hours' | 'reserve' | 'ok' | 'note'

// 빨강=휴무, 노랑=영업시간 문제, 보라=예약 필요, 초록=완료, 점선 테두리=확인 필요
const STYLE: Record<BadgeTone, string> = {
  closed: 'bg-danger text-white',
  hours: 'bg-warn text-ink',
  reserve: 'bg-reserve text-white',
  ok: 'bg-ok text-white',
  note: 'bg-card text-ink border-2 border-dashed border-ink-soft',
}

export default function Badge({ tone, children }: { tone: BadgeTone; children: ReactNode }) {
  return (
    <span
      className={`font-display inline-flex min-h-6 items-center rounded-md px-2 text-[0.8125rem] leading-none ${STYLE[tone]}`}
    >
      {children}
    </span>
  )
}
