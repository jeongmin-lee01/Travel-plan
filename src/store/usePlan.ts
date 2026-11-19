import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  applyOrder,
  computePlan,
  defaultData,
  emptyState,
  reoptimize,
  toggle,
  updateEntry,
} from '../engine'
import type { DateStr, DayPlan, PlanState, ToggleResult } from '../types'
import { fmtSigned } from '../lib/format'

const KEY = 'travel-plan:state:v1'

/** 저장된 상태에서 지금 데이터에 없는 장소·날짜는 걸러낸다(데이터가 바뀌어도 앱이 깨지지 않게) */
function sanitize(raw: unknown): PlanState {
  const s = emptyState()
  if (!raw || typeof raw !== 'object') return s
  const { checked, manualOrder } = raw as Partial<PlanState>
  const dates = new Set(defaultData.itinerary.days.filter((d) => d.freeWindow).map((d) => d.date))
  const ids = new Set(defaultData.places.filter((p) => p.type === 'candidate').map((p) => p.id))
  for (const [id, e] of Object.entries(checked ?? {})) {
    if (ids.has(id) && e && dates.has(e.day)) s.checked[id] = e
  }
  for (const [date, order] of Object.entries(manualOrder ?? {})) {
    if (dates.has(date) && Array.isArray(order)) s.manualOrder[date] = order.filter((id) => s.checked[id]?.day === date)
  }
  return s
}

function load(): PlanState {
  try {
    const raw = localStorage.getItem(KEY)
    if (raw) return sanitize(JSON.parse(raw))
  } catch {
    // 저장소를 못 쓰는 환경(시크릿 모드 등): 빈 상태로 시작
  }
  return emptyState()
}

export interface Toast {
  id: number
  message: string
  detail?: string
  /** 되돌리기 */
  undo?: PlanState
}

const nameOf = (id: string) => defaultData.places.find((p) => p.id === id)?.name.ko ?? id
const dayLabel = (date: DateStr) => defaultData.itinerary.days.find((d) => d.date === date)?.label ?? date

function toastFor(r: ToggleResult, prev: PlanState): Omit<Toast, 'id'> {
  const name = nameOf(r.placeId)
  if (r.action === 'blocked') {
    const drops = r.dropSuggestions.filter((d) => d.makesFeasible).map((d) => nameOf(d.dropPlaceId))
    return {
      message: `${name}: 추가할 수 없어요`,
      detail: [r.reason, drops.length ? `빼면 들어가요: ${drops.join(', ')}` : ''].filter(Boolean).join(' · '),
    }
  }
  if (r.action === 'removed') return { message: `${name}: 후보로 되돌렸어요`, undo: prev }
  const d = r.diff!
  return {
    message: `${name}: ${dayLabel(r.day!)}에 추가했어요`,
    detail: `이동 ${fmtSigned(d.addedTravelMin, '분')} · 걸음 ${fmtSigned(d.addedSteps, '보')}${d.orderChanged ? ' · 순서가 바뀌었어요' : ''}`,
    undo: prev,
  }
}

export function usePlan() {
  const data = defaultData
  const [state, setState] = useState<PlanState>(load)
  const [toast, setToast] = useState<Toast | null>(null)

  useEffect(() => {
    try {
      localStorage.setItem(KEY, JSON.stringify(state))
    } catch {
      // 저장 실패는 무시: 화면은 그대로 동작
    }
  }, [state])

  useEffect(() => {
    if (!toast) return
    const t = setTimeout(() => setToast(null), 7000)
    return () => clearTimeout(t)
  }, [toast])

  const plans = useMemo(() => computePlan(data, state), [data, state])
  const planOf = useCallback((date: DateStr): DayPlan => plans.find((p) => p.date === date)!, [plans])

  const toggleCandidate = useCallback(
    (placeId: string, opts: { day?: DateStr } = {}): ToggleResult => {
      const r = toggle(data, state, placeId, opts)
      if (r.action !== 'blocked') setState(r.state)
      setToast({ id: Date.now(), ...toastFor(r, state) })
      return r
    },
    [data, state],
  )

  const setOrder = useCallback((date: DateStr, order: string[]) => setState((s) => applyOrder(s, date, order)), [])
  const reoptimizeDay = useCallback((date: DateStr) => setState((s) => reoptimize(s, date)), [])
  const setStay = useCallback((id: string, minutes: number) => setState((s) => updateEntry(s, id, { stayMinutes: minutes })), [])
  const setPin = useCallback((id: string, time: number | undefined) => setState((s) => updateEntry(s, id, { pinTime: time })), [])
  const undo = useCallback(() => {
    if (toast?.undo) setState(toast.undo)
    setToast(null)
  }, [toast])

  return {
    data,
    state,
    plans,
    planOf,
    toast,
    dismissToast: () => setToast(null),
    undo,
    toggleCandidate,
    setOrder,
    reoptimizeDay,
    setStay,
    setPin,
    resetAll: () => setState(emptyState()),
  }
}

export type PlanApi = ReturnType<typeof usePlan>
