import { useRef, useState } from 'react'
import type { PlanApi } from '../store/usePlan'
import Button from './Button'
import Input from './Input'
import Sheet from './Sheet'

/** 설정: 환율, 내보내기/불러오기, 초기화 */
export default function SettingsSheet({ open, onClose, api }: { open: boolean; onClose: () => void; api: PlanApi }) {
  const [rate, setRate] = useState<string | null>(null)
  const [message, setMessage] = useState('')
  const [confirmReset, setConfirmReset] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  const rateValue = rate ?? String(api.settings.yenToWon)
  const rateNum = Number(rateValue)
  const rateOk = Number.isFinite(rateNum) && rateNum > 0 && rateNum < 100

  const close = () => {
    if (rate !== null && rateOk) api.setSettings({ yenToWon: rateNum })
    setRate(null)
    setMessage('')
    setConfirmReset(false)
    onClose()
  }

  const exportFile = () => {
    const blob = new Blob([api.exportBackup()], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `travel-plan-${new Date().toISOString().slice(0, 10)}.json`
    a.click()
    URL.revokeObjectURL(url)
    setMessage('백업 파일을 저장했어요. 동행자 폰으로 보내 "불러오기"를 누르면 같은 동선이 나와요.')
  }

  const importFile = async (file: File | undefined) => {
    if (!file) return
    const r = api.importBackup(await file.text())
    setMessage(r.ok ? '불러왔어요. 체크·순서·직접 추가한 후보가 파일 내용으로 바뀌었어요.' : (r.reason ?? '불러오지 못했어요.'))
    if (fileRef.current) fileRef.current.value = ''
  }

  return (
    <Sheet open={open} title="설정" onClose={close}>
      <div className="space-y-6">
        <section className="space-y-2">
          <h3 className="font-display text-xl">환율</h3>
          <Input
            label="1엔 = 몇 원 (교통비를 원화로 어림해 보여줘요)"
            inputMode="decimal"
            value={rateValue}
            onChange={(e) => setRate(e.target.value)}
            onBlur={() => {
              if (rateOk) api.setSettings({ yenToWon: rateNum })
              setRate(null)
            }}
          />
          {!rateOk && <p className="text-[0.875rem] text-danger">0보다 크고 100보다 작은 숫자를 넣어 주세요.</p>}
          <p className="text-[0.875rem] text-ink-soft">실제 환율은 출발 전에 확인해서 바꿔 주세요.</p>
        </section>

        <section className="space-y-2">
          <h3 className="font-display text-xl">내보내기 · 불러오기</h3>
          <p className="text-[0.875rem] text-ink-soft">체크한 후보, 바꾼 순서, 직접 추가·수정한 후보, 환율이 파일 하나(JSON)에 담겨요.</p>
          <div className="flex gap-2">
            <Button variant="secondary" className="flex-1" onClick={exportFile}>
              내보내기
            </Button>
            <Button variant="secondary" className="flex-1" onClick={() => fileRef.current?.click()}>
              불러오기
            </Button>
          </div>
          <input ref={fileRef} type="file" accept="application/json,.json" hidden onChange={(e) => importFile(e.target.files?.[0])} />
        </section>

        <section className="space-y-2">
          <h3 className="font-display text-xl">데이터 초기화</h3>
          <p className="text-[0.875rem] text-ink-soft">체크, 순서, 직접 추가한 후보, 위치 수정을 모두 지우고 처음 상태로 돌려요. 되돌릴 수 없으니 먼저 내보내기를 해 두세요.</p>
          {confirmReset ? (
            <div className="flex gap-2">
              <Button
                variant="secondary"
                className="flex-1 border-danger text-danger"
                onClick={() => {
                  api.resetAll()
                  setConfirmReset(false)
                  setMessage('처음 상태로 돌렸어요.')
                }}
              >
                정말 지우기
              </Button>
              <Button variant="secondary" className="flex-1" onClick={() => setConfirmReset(false)}>
                취소
              </Button>
            </div>
          ) : (
            <Button variant="secondary" className="w-full" onClick={() => setConfirmReset(true)}>
              초기화
            </Button>
          )}
        </section>

        {message && (
          <p role="status" className="rounded-2xl bg-paper-deep px-4 py-3 text-base">
            {message}
          </p>
        )}
      </div>
    </Sheet>
  )
}
