import type { ReactNode } from 'react'

export default function EmptyState({ title, hint, action }: { title: string; hint: string; action?: ReactNode }) {
  return (
    <div className="mx-4 mt-4 flex flex-col items-center gap-2 rounded-card border-2 border-dashed border-line px-6 py-10 text-center">
      <p className="font-display text-xl">{title}</p>
      <p className="text-base text-ink-soft">{hint}</p>
      {action && <div className="mt-3">{action}</div>}
    </div>
  )
}
