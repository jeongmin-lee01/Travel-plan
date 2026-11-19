import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  applyOrder,
  computePlan,
  defaultData,
  emptyState,
  entryKey,
  reoptimize,
  toggle,
  updateEntry,
  withoutPlace,
} from '../engine'
import type { DateStr, DayPlan, EngineData, PlanState, ToggleResult } from '../types'
import { fmtSigned } from '../lib/format'
import {
  applyUserData,
  emptyUserData,
  isCustom,
  makeCandidate,
  sanitizeUserData,
  type NewCandidateInput,
  type UserData,
} from './userData'

const KEY = 'travel-plan:state:v2'
const OLD_KEY = 'travel-plan:state:v1'
const USER_KEY = 'travel-plan:userdata:v1'

/** 저장된 상태에서 지금 데이터에 없는 장소·날짜는 걸러낸다(데이터가 바뀌어도 앱이 깨지지 않게) */
function sanitize(raw: unknown, customIds: string[]): PlanState {
  const s = emptyState()
  if (!raw || typeof raw !== 'object') return s
  const { checked, manualOrder } = raw as Partial<PlanState>
  const dates = new Set(defaultData.itinerary.days.filter((d) => d.freeWindow).map((d) => d.date))
  const ids = new Set([...defaultData.places.filter((p) => p.type === 'candidate').map((p) => p.id), ...customIds])
  for (const [k, e] of Object.entries(checked ?? {})) {
    // 예전 형식(키가 곧 후보 id, 후보당 한 날짜)도 읽어 들인다
    const placeId = e?.placeId ?? k
    if (e && ids.has(placeId) && dates.has(e.day)) s.checked[entryKey(placeId, e.day)] = { ...e, placeId }
  }
  for (const [date, order] of Object.entries(manualOrder ?? {})) {
    if (dates.has(date) && Array.isArray(order)) s.manualOrder[date] = order.filter((id) => s.checked[entryKey(id, date)])
  }
  return s
}

function loadJson<T>(key: string, parse: (raw: unknown) => T): T | null {
  try {
    const raw = localStorage.getItem(key)
    if (raw) return parse(JSON.parse(raw))
  } catch {
    // 저장소를 못 쓰는 환경(시크릿 모드 등): 빈 상태로 시작
  }
  return null
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
  /** 주의 문구가 있는 알림(강조해서 보여준다) */
  caution?: boolean
  /** 되돌리기 */
  undo?: () => void
}

export function usePlan() {
  const [userData, setUserData] = useState<UserData>(() => loadJson(USER_KEY, sanitizeUserData) ?? emptyUserData())
  const [state, setState] = useState<PlanState>(() => {
    const customIds = userData.custom.map((p) => p.id)
    return loadJson(KEY, (raw) => sanitize(raw, customIds)) ?? loadJson(OLD_KEY, (raw) => sanitize(raw, customIds)) ?? emptyState()
  })
  const [toast, setToast] = useState<Toast | null>(null)

  const data = useMemo(() => applyUserData(defaultData, userData), [userData])

  useEffect(() => saveJson(KEY, state), [state])
  useEffect(() => saveJson(USER_KEY, userData), [userData])
  useEffect(() => {
    if (!toast) return
    const t = setTimeout(() => setToast(null), toast.caution ? 10000 : 7000)
    return () => clearTimeout(t)
  }, [toast])

  const plans = useMemo(() => computePlan(data, state), [data, state])
  const planOf = useCallback((date: DateStr): DayPlan => plans.find((p) => p.date === date)!, [plans])
  const say = (t: Omit<Toast, 'id'>) => setToast({ id: Date.now(), ...t })

  /** 체크/해제 결과를 알림으로 만든다. 주의할 점이 있으면 함께 보여준다 */
  const announce = (d: EngineData, r: ToggleResult, prev: PlanState) => {
    const name = d.places.find((p) => p.id === r.placeId)?.name.ko ?? r.placeId
    const dayLabel = (date: DateStr) => d.itinerary.days.find((x) => x.date === date)?.label ?? date
    if (r.action === 'blocked') {
      say({ message: `${name}: 추가할 수 없어요`, detail: r.reason })
    } else if (r.action === 'removed') {
      say({ message: `${name}: ${dayLabel(r.day!)}에서 뺐어요`, undo: () => setState(prev) })
    } else {
      const diff = r.diff!
      const stats = `이동 ${fmtSigned(diff.addedTravelMin, '분')} · 걸음 ${fmtSigned(diff.addedSteps, '보')}${diff.orderChanged ? ' · 순서가 바뀌었어요' : ''}`
      say({
        message: `${name}: ${dayLabel(r.day!)}에 추가했어요`,
        detail: r.cautions.length ? `주의: ${r.cautions.join(' · ')}` : stats,
        caution: r.cautions.length > 0,
        undo: () => setState(prev),
      })
    }
  }

  /** 후보를 그 날짜에 체크/해제한다(날짜별로 따로) */
  const toggleCandidate = useCallback(
    (placeId: string, day: DateStr): ToggleResult => {
      const r = toggle(data, state, placeId, { day })
      if (r.action !== 'blocked') setState(r.state)
      announce(data, r, state)
      return r
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [data, state],
  )

  /** 후보 제거. 기본 장소는 숨김(복원 가능), 내가 추가한 장소는 삭제. 모든 날의 동선에서 함께 뺀다 */
  const removeCandidate = useCallback(
    (placeId: string) => {
      const prevState = state
      const prevUser = userData
      const name = data.places.find((p) => p.id === placeId)?.name.ko ?? placeId
      setState(withoutPlace(state, placeId))
      const custom = isCustom(placeId)
      setUserData(
        custom
          ? { ...userData, custom: userData.custom.filter((p) => p.id !== placeId) }
          : { ...userData, hidden: [...new Set([...userData.hidden, placeId])] },
      )
      say({
        message: custom ? `${name}: 삭제했어요` : `${name}: 후보 목록에서 제거했어요`,
        detail: custom ? undefined : '목록 위쪽 "제거한 후보"에서 복원할 수 있어요',
        undo: () => {
          setState(prevState)
          setUserData(prevUser)
        },
      })
    },
    [state, userData, data],
  )

  const restoreCandidate = useCallback((placeId: string) => {
    setUserData((u) => ({ ...u, hidden: u.hidden.filter((x) => x !== placeId) }))
  }, [])

  /** 위치 지정·수정. 이미 동선에 들어 있으면 새 위치로 순서를 다시 계산한다 */
  const setLocation = useCallback(
    (placeId: string, loc: { lat: number; lng: number; address?: string }) => {
      setUserData((u) => ({ ...u, edits: { ...u.edits, [placeId]: loc } }))
      const name = data.places.find((p) => p.id === placeId)?.name.ko ?? placeId
      say({ message: `${name}: 위치를 저장했어요`, detail: '이제 체크해서 동선에 넣을 수 있어요' })
    },
    [data],
  )

  /**
   * 후보를 직접 추가한다. day를 주면 바로 그 날 동선에도 넣고 순서를 다시 계산한다.
   * 구글맵 링크에서 좌표를 못 읽으면 위치 없이 추가하고(나중에 "위치 지정") 이유를 알려준다.
   */
  const addCandidate = useCallback(
    (input: NewCandidateInput, opts: { day?: DateStr } = {}): { ok: boolean; message?: string } => {
      const id = `custom-${Date.now().toString(36)}`
      const { place, linkError } = makeCandidate(input, id)
      const nextUser: UserData = { ...userData, custom: [...userData.custom, place] }
      setUserData(nextUser)
      if (opts.day && place.lat !== null) {
        const nextData = applyUserData(defaultData, nextUser)
        const r = toggle(nextData, state, id, { day: opts.day })
        if (r.action !== 'blocked') setState(r.state)
        announce(nextData, r, state)
        return { ok: true }
      }
      say({
        message: `${place.name.ko}: 후보에 추가했어요`,
        detail: linkError ?? (place.lat === null ? '위치를 지정하면 체크해서 동선에 넣을 수 있어요' : '목록에서 체크하면 동선에 들어가요'),
      })
      return { ok: true, message: linkError }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [userData, state],
  )

  const setOrder = useCallback((date: DateStr, order: string[]) => setState((s) => applyOrder(s, date, order)), [])
  const reoptimizeDay = useCallback((date: DateStr) => setState((s) => reoptimize(s, date)), [])
  const setStay = useCallback((id: string, date: DateStr, minutes: number) => setState((s) => updateEntry(s, id, date, { stayMinutes: minutes })), [])
  const setPin = useCallback((id: string, date: DateStr, time: number | undefined) => setState((s) => updateEntry(s, id, date, { pinTime: time })), [])
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
    addCandidate,
    setOrder,
    reoptimizeDay,
    setStay,
    setPin,
  }
}

export type PlanApi = ReturnType<typeof usePlan>
