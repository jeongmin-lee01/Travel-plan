import type { DateStr, Minutes, Place } from '../types'

export const toMin = (s: string): Minutes => {
  const [h, m] = s.split(':').map(Number)
  return h * 60 + m
}

export const toHHMM = (m: Minutes): string => {
  const h = Math.floor(m / 60)
  const mm = Math.round(m % 60)
  return `${String(h).padStart(2, '0')}:${String(mm).padStart(2, '0')}`
}

/** 일본 공휴일(여행 기간). 평일 대신 토일공휴일 영업시간을 적용한다 */
const HOLIDAYS = new Set<DateStr>(['2026-11-23'])

export function isHolidayOrWeekend(date: DateStr): boolean {
  if (HOLIDAYS.has(date)) return true
  const day = new Date(`${date}T00:00:00Z`).getUTCDay()
  return day === 0 || day === 6
}

const RANGE = /(\d{1,2}):(\d{2})\s*[-~]\s*(\d{1,2}):(\d{2})/

/** 그날 적용되는 영업시간. 숫자로 읽을 수 없으면(확인 필요) null */
export function parseHours(place: Place, date: DateStr): { open: Minutes; close: Minutes } | null {
  const holiday = isHolidayOrWeekend(date)
  const text =
    (holiday && place.hours.weekendHoliday) || place.hours.weekday || place.hours.text || ''
  const m = RANGE.exec(text)
  if (!m) return null
  return { open: Number(m[1]) * 60 + Number(m[2]), close: Number(m[3]) * 60 + Number(m[4]) }
}
