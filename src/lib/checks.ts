import type { DayPlan, EngineData, Place } from '../types'

export interface CheckItem {
  placeId: string
  name: string
  tone: 'reserve' | 'hours' | 'note'
  title: string
  detail: string
  link?: string | null
  /** 어느 날 일정에 들어 있는지 */
  dayLabel?: string
}

const RESERVE_KINDS = ['필수', '정리권·추첨']

/** 동선에 들어 있거나 고정인 장소 중, 예약·정리권·영업시간 확인이 필요한 것을 모은다 */
export function collectChecks(data: EngineData, plans: DayPlan[]): CheckItem[] {
  const inRoute = new Map<string, string>()
  for (const plan of plans) {
    const label = data.itinerary.days.find((d) => d.date === plan.date)?.label
    for (const id of plan.order) if (label) inRoute.set(id, label)
  }
  const relevant: Place[] = data.places.filter((p) => p.type === 'fixed' || inRoute.has(p.id))

  const items: CheckItem[] = []
  for (const p of relevant) {
    const dayLabel = inRoute.get(p.id)
    const base = { placeId: p.id, name: p.name.ko, dayLabel }
    if (RESERVE_KINDS.includes(p.reservation.kind) && !p.myReservation.time) {
      items.push({
        ...base,
        tone: 'reserve',
        title: p.reservation.kind === '정리권·추첨' ? '정리권·추첨 확인' : '예약 필요',
        detail: p.reservation.note ?? '내 예약 정보가 비어 있어요',
        link: p.reservation.link,
      })
    } else if (p.reservation.kind === '확인 필요') {
      items.push({ ...base, tone: 'note', title: '문의 필요', detail: p.reservation.note ?? '확인이 필요해요', link: p.reservation.link })
    }
    if (p.type === 'candidate' && p.needsCheck.includes('hours')) {
      items.push({ ...base, tone: 'hours', title: '영업시간 확인 필요', detail: p.hours.text ?? '영업시간을 찾지 못했어요' })
    }
    if (p.type === 'candidate' && p.needsCheck.includes('closedDays')) {
      items.push({ ...base, tone: 'note', title: '휴무일 확인 필요', detail: p.exceptions.join(' / ') || '휴무 정보를 확인하지 못했어요' })
    }
  }
  const order = { reserve: 0, hours: 1, note: 2 } as const
  return items.sort((a, b) => order[a.tone] - order[b.tone])
}
