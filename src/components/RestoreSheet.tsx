import { normalizeCategory } from '../lib/categories'
import type { Place } from '../types'
import Button from './Button'
import { Card } from './Card'
import Sheet from './Sheet'

/** 후보 목록에서 제거한 장소를 다시 불러온다 */
export default function RestoreSheet({
  open,
  places,
  onRestore,
  onClose,
}: {
  open: boolean
  places: Place[]
  onRestore: (id: string) => void
  onClose: () => void
}) {
  return (
    <Sheet open={open} title="제거한 후보" onClose={onClose}>
      {places.length === 0 ? (
        <p className="text-base text-ink-soft">제거한 후보가 없어요.</p>
      ) : (
        <ul className="space-y-2">
          {places.map((p) => (
            <li key={p.id}>
              <Card className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-display text-lg leading-tight">{p.name.ko}</p>
                  <p className="text-[0.875rem] text-ink-soft">{normalizeCategory(p.category)}</p>
                </div>
                <Button variant="secondary" className="shrink-0 text-base" onClick={() => onRestore(p.id)}>
                  복원
                </Button>
              </Card>
            </li>
          ))}
        </ul>
      )}
    </Sheet>
  )
}
