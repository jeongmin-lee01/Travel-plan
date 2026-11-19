import type { CheckItem, CheckTone } from '../lib/checks'
import Badge, { type BadgeTone } from '../components/Badge'
import { Card } from '../components/Card'
import EmptyState from '../components/EmptyState'
import PageHeader from '../components/PageHeader'

const SECTIONS: { title: string; tones: CheckTone[]; badge: BadgeTone; label: string }[] = [
  { title: '일정 경고', tones: ['block', 'warn'], badge: 'closed', label: '경고' },
  { title: '예약·정리권', tones: ['reserve'], badge: 'reserve', label: '예약' },
  { title: '영업시간·휴무 확인', tones: ['hours'], badge: 'hours', label: '영업시간' },
  { title: '그 밖에 확인할 것', tones: ['note'], badge: 'note', label: '확인' },
]

/** 오른쪽 탭: 지금 동선에서 확인·예약이 필요한 것들 */
export default function CheckPage({ items, onSettings }: { items: CheckItem[]; onSettings: () => void }) {
  return (
    <>
      <PageHeader onSettings={onSettings} title="확인 필요" sub={items.length ? `${items.length}건 · 동선에 넣은 곳 기준이에요` : undefined} />
      {items.length === 0 && (
        <EmptyState title="확인할 게 없어요" hint="후보를 체크하면 예약이나 영업시간 확인이 필요한 곳이 여기에 모여요." />
      )}
      <div className="space-y-6 px-4">
        {SECTIONS.map((s) => {
          const list = items.filter((it) => s.tones.includes(it.tone))
          if (list.length === 0) return null
          return (
            <section key={s.title} aria-label={s.title} className="space-y-2">
              <h2 className="font-display text-xl">
                {s.title} <span className="text-base text-ink-soft">{list.length}</span>
              </h2>
              <ul className="space-y-2">
                {list.map((it, i) => (
                  <li key={`${it.placeId ?? it.name}-${i}`}>
                    <Card>
                      <div className="mb-1 flex flex-wrap items-center gap-2">
                        <Badge tone={it.tone === 'warn' ? 'hours' : s.badge}>{it.tone === 'warn' ? '주의' : s.label}</Badge>
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
            </section>
          )
        })}
      </div>
    </>
  )
}
