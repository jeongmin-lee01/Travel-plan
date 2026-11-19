export type MarkerKind = 'fixed' | 'route' | 'candidate'

/** 지도 마커. fixed=고정(검정 네모), route=동선(주황 원+번호), candidate=후보(점선 원) */
export default function MapMarker({ kind, n }: { kind: MarkerKind; n?: number }) {
  const base = 'font-display flex h-9 w-9 items-center justify-center text-lg leading-none'
  if (kind === 'fixed') return <span className={`${base} rounded-lg bg-ink text-paper`}>{n}</span>
  if (kind === 'route')
    return <span className={`${base} rounded-full border-2 border-ink bg-accent text-ink`}>{n}</span>
  return <span className={`${base} rounded-full border-2 border-dashed border-ink-soft bg-card`} />
}
