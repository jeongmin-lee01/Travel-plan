import type { ReactNode } from 'react'
import Button from './Button'

/** 아래에서 올라오는 시트 */
export default function Sheet({
  open,
  title,
  onClose,
  children,
}: {
  open: boolean
  title: string
  onClose: () => void
  children: ReactNode
}) {
  if (!open) return null
  return (
    <div className="fixed inset-0 z-30 flex items-end bg-ink/50" onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        onClick={(e) => e.stopPropagation()}
        className="max-h-[88dvh] w-full overflow-y-auto rounded-t-3xl bg-paper px-4 pt-4 pb-[max(1.5rem,env(safe-area-inset-bottom))]"
      >
        <div className="mb-3 flex items-center justify-between gap-3">
          <h2 className="font-display text-2xl">{title}</h2>
          <Button variant="secondary" onClick={onClose} className="min-w-20">
            닫기
          </Button>
        </div>
        {children}
      </div>
    </div>
  )
}
