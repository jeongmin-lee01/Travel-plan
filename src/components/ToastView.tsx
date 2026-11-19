import type { Toast } from '../store/usePlan'

/** 체크/해제 결과 알림. 되돌리기로 직전 상태로 복귀 */
export default function ToastView({
  toast,
  onUndo,
  onClose,
}: {
  toast: Toast | null
  onUndo: () => void
  onClose: () => void
}) {
  if (!toast) return null
  return (
    <div
      role="status"
      className="fixed inset-x-3 bottom-[5.5rem] z-40 flex items-start gap-3 rounded-2xl bg-ink px-4 py-3 text-paper shadow-card"
    >
      <div className="min-w-0 flex-1">
        <p className="font-display text-base leading-snug">{toast.message}</p>
        {toast.detail && <p className="text-[0.875rem] leading-snug text-paper/80">{toast.detail}</p>}
      </div>
      {toast.undo && (
        <button onClick={onUndo} className="font-display min-h-11 shrink-0 rounded-xl bg-accent px-3 text-ink">
          되돌리기
        </button>
      )}
      <button onClick={onClose} aria-label="알림 닫기" className="min-h-11 shrink-0 px-1 text-paper/80">
        ✕
      </button>
    </div>
  )
}
