import type { DayPlan, EngineData, Place } from '../types'

export type CheckTone = 'block' | 'warn' | 'reserve' | 'hours' | 'note'

export interface CheckItem {
  placeId?: string
  name: string
  tone: CheckTone
  title: string
  detail: string
  link?: string | null
  /** 어느 날 일정인지 */
  dayLabel?: string
}

const RESERVE_KINDS = ['필수', '정리권·추첨']
/** 장소 카드에서 이미 배지로 보이거나 단순 참고인 경고는 "확인 필요" 목록에 올리지 않는다 */
const SKIP_FLAGS = new Set(['reservation-missing', 'hours-unverified', 'chain-duplicate'])

/**
 * 확인이 필요한 것들을 모은다.
 * 1) 일정 경고: 지금 동선에서 규칙을 어기거나 주의할 점(휴무일·영업시간·공항 시각·걸음 수 등)
 * 2) 예약·정리권, 영업시간·휴무 확인: 동선에 들어 있거나 고정인 장소 중 정보가 비어 있는 것
 */
export function collectChecks(data: EngineData, plans: DayPlan[]): CheckItem[] {
  const idToName = new Map(data.places.map((p) => [p.id, p.name.ko]))
  const dayLabel = (date: string) => data.itinerary.days.find((d) => d.date === date)?.label
  /** 후보 → 들어 있는 날짜들 */
  const inRoute = new Map<string, string[]>()
  const items: CheckItem[] = []

  for (const plan of plans) {
    for (const id of plan.order) inRoute.set(id, [...(inRoute.get(id) ?? []), dayLabel(plan.date) ?? ''])
    for (const f of plan.schedule.flags) {
      if (SKIP_FLAGS.has(f.code) || f.severity === 'info') continue
      items.push({
        placeId: f.placeId,
        name: f.placeId ? (idToName.get(f.placeId) ?? f.placeId) : (dayLabel(plan.date) ?? plan.date),
        tone: f.severity === 'block' ? 'block' : 'warn',
        title: f.severity === 'block' ? '이 일정은 지킬 수 없어요' : '주의',
        detail: f.message,
        dayLabel: dayLabel(plan.date),
      })
    }
  }

  const relevant: Place[] = data.places.filter((p) => p.type === 'fixed' || inRoute.has(p.id))
  for (const p of relevant) {
    const base = { placeId: p.id, name: p.name.ko, dayLabel: inRoute.get(p.id)?.join('·') || undefined }
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

  const order: Record<CheckTone, number> = { block: 0, warn: 1, reserve: 2, hours: 3, note: 4 }
  return items.sort((a, b) => order[a.tone] - order[b.tone])
}
