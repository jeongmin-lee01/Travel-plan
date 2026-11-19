import type { ButtonHTMLAttributes } from 'react'

type Variant = 'primary' | 'secondary' | 'ghost'

const STYLE: Record<Variant, string> = {
  primary: 'bg-accent text-ink border-b-4 border-accent-deep active:translate-y-0.5 active:border-b-2',
  secondary: 'bg-card text-ink border-2 border-line active:bg-paper-deep',
  ghost: 'text-accent-deep underline underline-offset-4 active:bg-paper-deep',
}

export default function Button({
  variant = 'primary',
  className = '',
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant }) {
  return (
    <button
      {...props}
      className={`font-display min-h-12 rounded-2xl px-5 text-lg transition-transform disabled:opacity-40 ${STYLE[variant]} ${className}`}
    />
  )
}
