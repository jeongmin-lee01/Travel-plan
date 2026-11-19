/** 시각은 자정 이후 분(minutes)으로 다룬다. 예: 09:30 → 570 */
export type Minutes = number
/** 'YYYY-MM-DD' */
export type DateStr = string

export interface PlaceHours {
  weekday?: string
  weekendHoliday?: string
  text?: string
}

export interface Place {
  id: string
  type: 'fixed' | 'candidate'
  name: { ko: string; ja: string }
  category: string
  address: string | null
  lat: number | null
  lng: number | null
  coordsApprox: boolean
  nearestStation: string
  area: string
  availableDates: DateStr[]
  googleMapsUrl: string
  hours: PlaceHours
  lastEntry: string | null
  closedDays: string[]
  /** 확정된 휴무일(있으면 하드 조건) */
  closedDates?: DateStr[]
  exceptions: string[]
  reservation: { kind: string; link: string | null; opensAt: string | null; note?: string }
  myReservation: { time: string | null; code: string | null }
  stayMinutes: { value: number; estimated: boolean }
  chainGroup: string | null
  sources: { url: string; checkedAt: string; note?: string }[]
  needsCheck: string[]
  notes: string
}

export interface MealWindow {
  start: string
  end: string
  minutes: number
}

export interface DayConfig {
  date: DateStr
  label: string
  weekday: string
  city: string
  note?: string
  fixed: { placeId: string; role: string; at?: string; minutes?: number; locked?: boolean; estimated?: boolean; note?: string }[]
  freeWindow: {
    startPlaceId: string
    start: string
    endPlaceId: string
    returnBy: string
    deadlineKind?: 'airport'
  } | null
  meals: { lunch: MealWindow | null; dinner: MealWindow | null } | null
  longHaulRoutes: string[]
}

export interface Defaults {
  bufferWalkMin: number
  bufferTransitMin: number
  walkMetersPerMin: number
  detourFactor: number
  walkMaxMeters: number
  stepsPerWalkMin: number
  stepsPerStoreMin: number
  stepsPerTrainLeg: number
  stepsTarget: number
  exactSearchMaxStops: number
}

export interface Itinerary {
  updatedAt: string
  assumptions: string[]
  defaults: Defaults
  days: DayConfig[]
}

export interface TransitOption {
  id: string
  name: string
  minutes: number
  walkMinutes: number
  fareYen: number
  transfers: number
  estimated: boolean
  breakdown: string
  sources: { url: string; checkedAt: string; note?: string }[]
}

export interface TransitRoute {
  id: string
  from: string
  to: string
  label: string
  options: TransitOption[]
}

export interface Transit {
  updatedAt: string
  note: string
  routes: TransitRoute[]
}

export interface EngineData {
  places: Place[]
  itinerary: Itinerary
  transit: Transit
}

// ───────── 결과 타입 ─────────

export type FlagCode =
  | 'closed-day' // 빨강: 그날 갈 수 없음(휴무·지역)
  | 'outside-hours' // 주황: 영업시간 밖
  | 'after-last-entry' // 주황: 마지막 입장 이후
  | 'reservation-missing' // 보라: 예약·정리권 필요한데 내 예약 정보 없음
  | 'reservation-late' // 예약 시각에 못 맞춤
  | 'hours-unverified' // 영업시간 확인 필요
  | 'meal-missed' // 점심·저녁 시간대 확보 실패
  | 'steps-over' // 걸음 수 초과
  | 'day-end-late' // 귀가 시각 초과
  | 'airport-deadline' // 공항 도착 시각을 못 맞춤
  | 'chain-duplicate' // 같은 체인 2곳 이상
  | 'no-coords' // 좌표 없음

export interface Flag {
  code: FlagCode
  /** block = 이 순서/조건은 불가, warn = 문제 있음, info = 참고 */
  severity: 'block' | 'warn' | 'info'
  placeId?: string
  message: string
}

export type TravelMode = 'walk' | 'train' | 'longhaul'

export interface TravelLeg {
  mode: TravelMode
  minutes: number
  fareYen: number
  steps: number
  estimated: boolean
  mapsUrl: string
  detail?: string
}

export interface StopPlan {
  kind: 'place' | 'meal'
  placeId?: string
  mealKind?: 'lunch' | 'dinner'
  /** 이 장소에 도착한 시각 */
  arrive: Minutes
  /** 실제 시작 시각(영업 시작·예약 대기 후) */
  start: Minutes
  end: Minutes
  waitMin: number
  /** 이전 장소에서 여기까지 이동 */
  travel?: TravelLeg
}

export interface DaySchedule {
  date: DateStr
  stops: StopPlan[]
  /** 숙소(귀가) 도착 시각 */
  endArrive: Minutes
  returnTravel?: TravelLeg
  totals: { travelMin: number; waitMin: number; fareYen: number; steps: number }
  flags: Flag[]
  feasible: boolean
  cost: number
}

export interface OptimizeResult {
  order: string[]
  schedule: DaySchedule
  feasible: boolean
  method: 'exact' | 'heuristic' | 'none'
}

// ───────── 체크리스트 상태(저장되는 데이터) ─────────

export interface CheckedEntry {
  day: DateStr
  /** 이 시각에 시작하도록 고정(고정 핀·예약 시각) */
  pinTime?: Minutes
  /** 이 장소 체류시간 직접 수정 */
  stayMinutes?: number
}

export interface PlanState {
  checked: Record<string, CheckedEntry>
  /** 손으로 바꾼 순서. 있으면 자동 최적화보다 우선 */
  manualOrder: Record<DateStr, string[]>
}

export interface DayPlan {
  date: DateStr
  order: string[]
  manual: boolean
  schedule: DaySchedule
}

export interface DayRank {
  day: DateStr
  feasible: boolean
  /** 휴무·지역 때문에 아예 갈 수 없는 날 */
  unavailable?: boolean
  /** 추가했을 때 늘어나는 비용(분 환산). 작을수록 잘 맞음 */
  addedCost: number
  reason?: string
}

export interface PlanDiff {
  orderBefore: string[]
  orderAfter: string[]
  orderChanged: boolean
  addedTravelMin: number
  addedWaitMin: number
  addedSteps: number
  addedFareYen: number
  endArriveBefore: Minutes
  endArriveAfter: Minutes
}

export interface DropSuggestion {
  dropPlaceId: string
  /** 이걸 빼면 후보를 넣을 수 있음 */
  makesFeasible: boolean
}

export interface ToggleResult {
  action: 'added' | 'removed' | 'blocked'
  placeId: string
  day?: DateStr
  state: PlanState
  before?: DaySchedule
  after?: DaySchedule
  diff?: PlanDiff
  flags: Flag[]
  rankedDays: DayRank[]
  dropSuggestions: DropSuggestion[]
  reason?: string
}
