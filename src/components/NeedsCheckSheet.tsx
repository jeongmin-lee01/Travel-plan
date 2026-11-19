import type { CheckItem } from '../lib/checks'
import Badge from './Badge'
import { Card } from './Card'
import Sheet from './Sheet'

const TONE_LABEL = { reserve: '예약', hours: '영업시간', note: '확인' } as const

export default function NeedsCheckSheet({
  open,
  items,
  onClose,
}: {
  open: boolean
  items: CheckItem[]
  onClose: () => void
}) {
  return (
    <Sheet open={open} title="확인·예약 필요" onClose={onClose}>
      {items.length === 0 ? (
        <p className="text-base text-ink-soft">지금 동선에서 확인할 항목이 없어요.</p>
      ) : (
        <ul className="space-y-3">
          {items.map((it, i) => (
            <li key={`${it.placeId}-${i}`}>
              <Card>
                <div className="mb-1 flex flex-wrap items-center gap-2">
                  <Badge tone={it.tone}>{TONE_LABEL[it.tone]}</Badge>
                  <p className="font-display text-lg">{it.name}</p>
                  {it.dayLabel && <span className="text-[0.875rem] text-ink-soft">{it.dayLabel}</span>}
                </div>
                <p className="text-base">{it.title}</p>
                <p className="text-[0.875rem] text-ink-soft">{it.detail}</p>
                {it.link && (
                  <a href={it.link} target="_blank" rel="noreferrer" className="mt-1 inline-block text-base text-accent-deep underline underline-offset-4">
                    예약·안내 페이지 열기
                  </a>
                )}
              </Card>
            </li>
          ))}
        </ul>
      )}
    </Sheet>
  )
}
