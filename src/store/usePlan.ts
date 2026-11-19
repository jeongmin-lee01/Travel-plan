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
import { applyUserData, emptyUserData, sanitizeUserData, type UserData } from './userData'

const KEY = 'travel-plan:state:v1'
const USER_KEY = 'travel-plan:userdata:v1'

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

function loadJson<T>(key: string, parse: (raw: unknown) => T, fallback: () => T): T {
  try {
    const raw = localStorage.getItem(key)
    if (raw) return parse(JSON.parse(raw))
  } catch {
    // 저장소를 못 쓰는 환경(시크릿 모드 등): 빈 상태로 시작
  }
  return fallback()
}

function saveJson(key: string, value: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(value))
  } catch {
    // 저장 실패는 무시: 화면은 그대로 동작
  }
}

export interface Toast {
  id: number
  message: string
  detail?: string
  /** 되돌리기 */
  undo?: () => void
}

const nameOf = (id: string) => defaultData.places.find((p) => p.id === id)?.name.ko ?? id
const dayLabel = (date: DateStr) => defaultData.itinerary.days.find((d) => d.date === date)?.label ?? date

export function usePlan() {
  const [state, setState] = useState<PlanState>(() => loadJson(KEY, sanitize, emptyState))
  const [userData, setUserData] = useState<UserData>(() => loadJson(USER_KEY, sanitizeUserData, emptyUserData))
  const [toast, setToast] = useState<Toast | null>(null)

  const data = useMemo(() => applyUserData(defaultData, userData), [userData])

  useEffect(() => saveJson(KEY, state), [state])
  useEffect(() => saveJson(USER_KEY, userData), [userData])
  useEffect(() => {
    if (!toast) return
    const t = setTimeout(() => setToast(null), 7000)
    return () => clearTimeout(t)
  }, [toast])

  const plans = useMemo(() => computePlan(data, state), [data, state])
  const planOf = useCallback((date: DateStr): DayPlan => plans.find((p) => p.date === date)!, [plans])
  const say = (t: Omit<Toast, 'id'>) => setToast({ id: Date.now(), ...t })

  const toggleCandidate = useCallback(
    (placeId: string, opts: { day?: DateStr } = {}): ToggleResult => {
      const prev = state
      const r = toggle(data, state, placeId, opts)
      if (r.action !== 'blocked') setState(r.state)
      const name = nameOf(r.placeId)
      if (r.action === 'blocked') {
        const drops = r.dropSuggestions.filter((d) => d.makesFeasible).map((d) => nameOf(d.dropPlaceId))
        say({
          message: `${name}: 추가할 수 없어요`,
          detail: [r.reason, drops.length ? `빼면 들어가요: ${drops.join(', ')}` : ''].filter(Boolean).join(' · '),
        })
      } else if (r.action === 'removed') {
        say({ message: `${name}: 후보로 되돌렸어요`, undo: () => setState(prev) })
      } else {
        const d = r.diff!
        say({
          message: `${name}: ${dayLabel(r.day!)}에 추가했어요`,
          detail: `이동 ${fmtSigned(d.addedTravelMin, '분')} · 걸음 ${fmtSigned(d.addedSteps, '보')}${d.orderChanged ? ' · 순서가 바뀌었어요' : ''}`,
          undo: () => setState(prev),
        })
      }
      return r
    },
    [data, state],
  )

  /** 후보 목록에서 제거(숨김). 동선에 들어 있으면 함께 뺀다. 복원 가능 */
  const removeCandidate = useCallback(
    (placeId: string) => {
      const prevState = state
      const prevUser = userData
      const entry = state.checked[placeId]
      if (entry) {
        const checked = { ...state.checked }
        delete checked[placeId]
        const manualOrder = { ...state.manualOrder }
        if (manualOrder[entry.day]) manualOrder[entry.day] = manualOrder[entry.day].filter((x) => x !== placeId)
        setState({ checked, manualOrder })
      }
      setUserData({ ...userData, hidden: [...new Set([...userData.hidden, placeId])] })
      say({
        message: `${nameOf(placeId)}: 후보 목록에서 제거했어요`,
        detail: '목록 위쪽 "제거한 후보"에서 복원할 수 있어요',
        undo: () => {
          setState(prevState)
          setUserData(prevUser)
        },
      })
    },
    [state, userData],
  )

  const restoreCandidate = useCallback((placeId: string) => {
    setUserData((u) => ({ ...u, hidden: u.hidden.filter((x) => x !== placeId) }))
  }, [])

  /** 위치 지정·수정. 이미 동선에 들어 있으면 새 위치로 순서를 다시 계산한다 */
  const setLocation = useCallback(
    (placeId: string, loc: { lat: number; lng: number; address?: string }) => {
      setUserData((u) => ({ ...u, edits: { ...u.edits, [placeId]: loc } }))
      say({ message: `${nameOf(placeId)}: 위치를 저장했어요`, detail: '이제 체크해서 동선에 넣을 수 있어요' })
    },
    [],
  )

  const setOrder = useCallback((date: DateStr, order: string[]) => setState((s) => applyOrder(s, date, order)), [])
  const reoptimizeDay = useCallback((date: DateStr) => setState((s) => reoptimize(s, date)), [])
  const setStay = useCallback((id: string, minutes: number) => setState((s) => updateEntry(s, id, { stayMinutes: minutes })), [])
  const setPin = useCallback((id: string, time: number | undefined) => setState((s) => updateEntry(s, id, { pinTime: time })), [])
  const undo = useCallback(() => {
    toast?.undo?.()
    setToast(null)
  }, [toast])

  return {
    data,
    state,
    userData,
    plans,
    planOf,
    toast,
    dismissToast: () => setToast(null),
    undo,
    toggleCandidate,
    removeCandidate,
    restoreCandidate,
    setLocation,
    setOrder,
    reoptimizeDay,
    setStay,
    setPin,
  }
}

export type PlanApi = ReturnType<typeof usePlan>
