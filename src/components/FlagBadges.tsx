import type { Flag, Place } from '../types'
import Badge from './Badge'

/** 장소 카드의 경고 배지: 빨강=휴무, 노랑=영업시간, 보라=예약·정리권 */
export default function FlagBadges({ flags, place }: { flags: Flag[]; place: Place }) {
  const codes = new Set(flags.filter((f) => f.placeId === place.id).map((f) => f.code))
  return (
    <>
      {codes.has('closed-day') && <Badge tone="closed">휴무 · 이 날 불가</Badge>}
      {codes.has('outside-hours') && <Badge tone="hours">영업시간 밖</Badge>}
      {codes.has('after-last-entry') && <Badge tone="hours">마지막 입장 이후</Badge>}
      {codes.has('reservation-late') && <Badge tone="hours">고정 시각 못 맞춤</Badge>}
      {codes.has('reservation-missing') && (
        <Badge tone="reserve">{place.reservation.kind === '정리권·추첨' ? '정리권 필요' : '예약 필요'}</Badge>
      )}
      {codes.has('hours-unverified') && <Badge tone="note">영업시간 확인 필요</Badge>}
    </>
  )
}
