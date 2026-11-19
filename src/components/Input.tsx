import type { InputHTMLAttributes } from 'react'

export default function Input({
  label,
  className = '',
  ...props
}: InputHTMLAttributes<HTMLInputElement> & { label: string }) {
  return (
    <label className="block">
      <span className="mb-1 block text-base text-ink-soft">{label}</span>
      <input
        {...props}
        className={`min-h-12 w-full rounded-2xl border-2 border-line bg-card px-4 text-base text-ink placeholder:text-ink-soft/70 focus:border-ink focus:outline-none ${className}`}
      />
    </label>
  )
}
