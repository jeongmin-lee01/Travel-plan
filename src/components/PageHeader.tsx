export default function PageHeader({ title, sub }: { title: string; sub?: string }) {
  return (
    <header className="px-4 pt-[max(1.25rem,env(safe-area-inset-top))] pb-3">
      <h1 className="font-display text-3xl leading-tight">{title}</h1>
      {sub && <p className="text-base text-ink-soft">{sub}</p>}
    </header>
  )
}
