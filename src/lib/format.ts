import type { DayConfig } from '../types'

export function fmtDur(min: number): string {
  const m = Math.max(0, Math.round(min))
  const h = Math.floor(m / 60)
  const r = m % 60
  if (h === 0) return `${r}분`
  return r === 0 ? `${h}시간` : `${h}시간 ${r}분`
}

export const fmtNum = (n: number): string => Math.round(n).toLocaleString('ko-KR')

/** 'YYYY-MM-DD' + 요일 → '11/24(화)' */
export function fmtDate(day: DayConfig): string {
  return `${day.date.slice(5).replace('-', '/')}(${day.weekday})`
}

export function fmtSigned(n: number, unit: string): string {
  const v = Math.round(n)
  return `${v >= 0 ? '+' : '−'}${fmtNum(Math.abs(v))}${unit}`
}
