import type { ButtonHTMLAttributes } from 'react'

/** 필터·토글용 알약 버튼. 켜지면 주황 배경 */
export default function Chip({
  active,
  className = '',
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { active?: boolean }) {
  return (
    <button
      {...props}
      aria-pressed={active}
      className={`min-h-11 shrink-0 rounded-full border-2 px-4 text-base transition-colors ${
        active ? 'border-ink bg-accent text-ink font-bold' : 'border-line bg-card text-ink-soft'
      } ${className}`}
    />
  )
}
