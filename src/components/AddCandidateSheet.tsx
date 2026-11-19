import { useState } from 'react'
import type { DateStr, DayConfig } from '../types'
import { CATEGORIES, type Category } from '../lib/categories'
import { fmtDate } from '../lib/format'
import type { NewCandidateInput } from '../store/userData'
import Button from './Button'
import Chip from './Chip'
import Input from './Input'
import Sheet from './Sheet'

/** 후보 추가 폼. 추가한 후보는 체크리스트에 들어가고, day를 주면 그 날 동선에도 바로 넣는다 */
export default function AddCandidateSheet({
  day,
  onClose,
  onSave,
}: {
  day?: DayConfig
  onClose: () => void
  onSave: (input: NewCandidateInput, opts: { day?: DateStr }) => unknown
}) {
  const [name, setName] = useState('')
  const [link, setLink] = useState('')
  const [category, setCategory] = useState<Category>('기타')
  const [stay, setStay] = useState(40)
  const [hours, setHours] = useState('')
  const [reserve, setReserve] = useState(false)
  const [addToDay, setAddToDay] = useState(true)
  const [error, setError] = useState('')

  const submit = () => {
    if (!name.trim()) {
      setError('이름을 입력해 주세요')
      return
    }
    if (!Number.isFinite(stay) || stay < 10) {
      setError('체류시간은 10분 이상으로 입력해 주세요')
      return
    }
    onSave(
      { name, mapsLink: link, category, stayMinutes: stay, hours, needsReservation: reserve },
      { day: day && addToDay ? day.date : undefined },
    )
    onClose()
  }

  return (
    <Sheet open title="후보 추가" onClose={onClose}>
      <div className="space-y-4">
        <Input label="이름" value={name} onChange={(e) => setName(e.target.value)} placeholder="예: 잇푸도 가와라마치점" />
        <Input
          label="구글맵 링크 (선택)"
          value={link}
          onChange={(e) => setLink(e.target.value)}
          placeholder="구글맵에서 연 장소의 긴 주소"
        />
        <p className="-mt-2 text-[0.875rem] text-ink-soft">
          링크를 넣으면 위치를 읽어 동선에 바로 넣을 수 있어요. 비워 두면 나중에 "위치 지정"으로 정할 수 있어요.
        </p>

        <div>
          <p className="mb-1 text-base text-ink-soft">카테고리</p>
          <div className="flex flex-wrap gap-2">
            {CATEGORIES.map((c) => (
              <Chip key={c} active={category === c} onClick={() => setCategory(c)}>
                {c}
              </Chip>
            ))}
          </div>
        </div>

        <Input label="예상 체류시간 (분)" type="number" inputMode="numeric" min={10} step={5} value={stay} onChange={(e) => setStay(Number(e.target.value))} />
        <Input label="영업시간 (선택)" value={hours} onChange={(e) => setHours(e.target.value)} placeholder="예: 11:00-20:00" />

        <div className="flex gap-2">
          <Chip active={reserve} onClick={() => setReserve((v) => !v)}>
            예약 필요
          </Chip>
        </div>

        {day?.freeWindow && (
          <div>
            <Chip active={addToDay} onClick={() => setAddToDay((v) => !v)}>
              {day.label} {fmtDate(day)} 동선에 바로 넣기
            </Chip>
          </div>
        )}

        {error && <p className="rounded-xl border-2 border-danger px-3 py-2 text-base text-danger">{error}</p>}
        <Button className="w-full" onClick={submit}>
          후보 추가
        </Button>
      </div>
    </Sheet>
  )
}
