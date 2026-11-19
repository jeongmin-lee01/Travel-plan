import type { DateStr, EngineData } from '../types'
import { fmtDate } from '../lib/format'

/** Day 1~4 탭. 동선 화면과 후보 화면이 같은 날짜를 공유한다 */
export default function DayTabs({ data, activeDate, onChange }: { data: EngineData; activeDate: DateStr; onChange: (d: DateStr) => void }) {
  return (
    <div role="tablist" aria-label="날짜" className="sticky top-0 z-10 flex gap-2 overflow-x-auto bg-paper px-4 pb-3 pt-1">
      {data.itinerary.days.map((d) => {
        const active = d.date === activeDate
        return (
          <button
            key={d.date}
            role="tab"
            aria-selected={active}
            onClick={() => onChange(d.date)}
            className={`min-h-14 min-w-[5.5rem] flex-1 rounded-2xl border-2 px-2 py-1 text-center ${
              active ? 'border-ink bg-accent' : 'border-line bg-card'
            }`}
          >
            <span className="font-display block text-lg leading-tight">{d.label}</span>
            <span className="block text-[0.8125rem] leading-tight">{fmtDate(d)}</span>
          </button>
        )
      })}
    </div>
  )
}
