import { GearIcon } from './Icons'

export default function PageHeader({ title, sub, onSettings }: { title: string; sub?: string; onSettings?: () => void }) {
  return (
    <header className="flex items-start justify-between gap-3 px-4 pt-[max(1.25rem,env(safe-area-inset-top))] pb-3">
      <div>
        <h1 className="font-display text-3xl leading-tight">{title}</h1>
        {sub && <p className="text-base text-ink-soft">{sub}</p>}
      </div>
      {onSettings && (
        <button
          type="button"
          onClick={onSettings}
          aria-label="설정"
          className="flex size-12 shrink-0 items-center justify-center rounded-2xl border-2 border-line bg-card text-ink active:bg-paper-deep"
        >
          <GearIcon />
        </button>
      )}
    </header>
  )
}
