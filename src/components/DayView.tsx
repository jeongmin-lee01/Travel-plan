import { useMemo, useState } from 'react'
import type { DayConfig, DayPlan, EngineData } from '../types'
import type { MapGroup } from '../lib/mapGroups'
import { toMin } from '../engine'
import { buildDayMap, googleRouteUrl } from '../lib/mapGroups'
import { fmtDur, fmtNum } from '../lib/format'
import type { PlanApi } from '../store/usePlan'
import Button from './Button'
import { Card } from './Card'
import Chip from './Chip'
import EmptyState from './EmptyState'
import RegionMap from './RegionMap'
import RouteTimeline from './RouteTimeline'

function Stat({ label, value, sub, warn }: { label: string; value: string; sub?: string; warn?: boolean }) {
  return (
    <div>
      <p className="text-[0.875rem] text-ink-soft">{label}</p>
      <p className={`font-display text-xl ${warn ? 'text-danger' : ''}`}>{value}</p>
      {sub && <p className="text-[0.8125rem] text-ink-soft">{sub}</p>}
    </div>
  )
}

export default function DayView({ data, day, plan, api }: { data: EngineData; day: DayConfig; plan: DayPlan; api: PlanApi }) {
  const [showCandidates, setShowCandidates] = useState(false)
  // 입국일·출국일은 공항까지 이어진 전체 경로를 먼저 보여준다
  const [showAll, setShowAll] = useState(() => day.fixed.some((f) => f.placeId === 'kix'))
  const sch = plan.schedule
  const count = plan.order.length
  const fw = day.freeWindow

  const dayMap = useMemo(
    () => buildDayMap(data, day, plan, api.state, showCandidates),
    [data, day, plan, api.state, showCandidates],
  )
  const routeUrl = googleRouteUrl(data, day, plan)

  const dayFlags = sch.flags.filter((f) => !f.placeId && f.code !== 'chain-duplicate')
  const remaining = fw ? toMin(fw.returnBy) - sch.endArrive : 0

  return (
    <section aria-label={`${day.label} 동선`} className="space-y-4 px-4">
      {/* 1. 지도: 앱을 열면 가장 먼저 보이고, 아래로 스크롤하면 동선이 나온다 */}
      <div className="space-y-2">
        <div className="flex items-center justify-between gap-3">
          <h3 className="font-display text-xl">지도</h3>
          <div className="flex flex-wrap justify-end gap-2">
            {dayMap && dayMap.fitAll.length > dayMap.fit.length && (
              <Chip active={showAll} onClick={() => setShowAll((v) => !v)}>
                전체 경로
              </Chip>
            )}
            {fw && (
              <Chip active={showCandidates} onClick={() => setShowCandidates((v) => !v)}>
                후보도 함께 보기
              </Chip>
            )}
          </div>
        </div>
        {dayMap ? <RegionMap group={dayMap} showAll={showAll} /> : <p className="text-base text-ink-soft">표시할 장소가 없어요.</p>}
        {dayMap && dayMap.path.length > 0 && (
          <p className="text-base text-ink-soft">
            {pathCaption(dayMap)}
            {dayMap.hasLongLeg && ' · 점선은 공항·교토처럼 멀리 떨어진 구간이에요'}
          </p>
        )}
        {routeUrl && (
          <a href={routeUrl} target="_blank" rel="noreferrer" className="block">
            <span className="font-display flex min-h-12 w-full items-center justify-center rounded-2xl border-2 border-line bg-card text-lg">
              구글맵에서 이 동선 보기
            </span>
          </a>
        )}
      </div>

      {/* 2. 동선 */}
      <div className="space-y-3 pt-2">
        <div>
          <h3 className="font-display text-xl">동선</h3>
          <p className="text-base text-ink-soft">
            {day.city}
            {day.note && ` · ${day.note}`}
          </p>
        </div>

        {plan.manual && (
          <Card className="flex items-center justify-between gap-3">
            <p className="text-base">직접 정한 순서예요. 시각과 경고만 다시 계산해요.</p>
            <Button variant="secondary" className="shrink-0 text-base" onClick={() => api.reoptimizeDay(day.date)}>
              다시 최적화
            </Button>
          </Card>
        )}

        {[...dayFlags, ...chainMessages(data, plan)].map((f, i) => (
          <p
            key={i}
            className={`rounded-xl border-2 px-3 py-2 text-base ${
              f.severity === 'block' ? 'border-danger text-danger' : f.severity === 'warn' ? 'border-warn' : 'border-line text-ink-soft'
            }`}
          >
            {f.message}
          </p>
        ))}

        {fw && count === 0 && (
          <EmptyState
            title="아직 체크한 후보가 없어요"
            hint="후보 탭에서 가고 싶은 곳을 체크하면 이 날 동선이 자동으로 정리돼요."
          />
        )}

        <RouteTimeline data={data} day={day} plan={plan} api={api} />

        {sch.totals.travelMin > 0 && (
          <Card>
            <div className="grid grid-cols-2 gap-4">
              {count > 0 && <Stat label="예상 걸음" value={`${fmtNum(sch.totals.steps)}보`} sub="참고용" />}
              <Stat
                label="이동 시간"
                value={fmtDur(sch.totals.travelMin)}
                sub={[
                  sch.totals.fixedLegMin > 0 ? `${fixedLegName(day)} ${fmtDur(sch.totals.fixedLegMin)} 포함` : '',
                  sch.totals.bufferMin > 0 ? `여유 ${fmtDur(sch.totals.bufferMin)} 별도` : '',
                  sch.totals.waitMin > 0 ? `오픈 대기 ${fmtDur(sch.totals.waitMin)}` : '',
                ]
                  .filter(Boolean)
                  .join(' · ')}
              />
              <Stat
                label="교통비"
                value={`${fmtNum(sch.totals.fareYen)}엔`}
                sub={sch.totals.fixedLegFareYen > 0 ? `${fixedLegName(day)} ${fmtNum(sch.totals.fixedLegFareYen)}엔 포함 · 추정` : '추정'}
              />
              {fw && count > 0 && (
                <Stat
                  label={fw.deadlineKind === 'airport' ? '공항 출발 전 여유' : '귀가 목표까지'}
                  value={remaining >= 0 ? fmtDur(remaining) : `${fmtDur(-remaining)} 초과`}
                  warn={remaining < 0}
                />
              )}
            </div>
          </Card>
        )}
      </div>
    </section>
  )
}

/** 합계에 포함된 고정 이동의 이름 */
function fixedLegName(day: DayConfig): string {
  return day.fixed.some((f) => f.placeId === 'kix') ? '공항 이동' : 'USJ 왕복'
}

/** 지도 선이 이어지는 순서를 글로 보여준다. 예) 공항 → 숙소 → 1번 → … → 3번 → 숙소 */
function pathCaption(map: MapGroup): string {
  const tokens: string[] = []
  let routeCount = 0
  const lastN = Math.max(0, ...map.path.map((p) => p.n ?? 0))
  for (const p of map.path) {
    if (p.icon === 'plane') tokens.push('공항 ✈')
    else if (p.icon === 'home') tokens.push('숙소')
    else if (p.kind === 'route') {
      routeCount++
      if (routeCount === 1) tokens.push(`${p.n}번`)
      else if (p.n === lastN) tokens.push(`${p.n}번`)
      else if (routeCount === 2) tokens.push('…')
    } else tokens.push(p.label)
  }
  return `${tokens.join(' → ')} 순서로 이어져요`
}

/** 같은 체인 매장 안내(그날 2곳 이상) */
function chainMessages(data: EngineData, plan: DayPlan) {
  const byGroup = new Map<string, number>()
  for (const id of plan.order) {
    const g = data.places.find((p) => p.id === id)?.chainGroup
    if (g) byGroup.set(g, (byGroup.get(g) ?? 0) + 1)
  }
  const out: { severity: 'info'; message: string }[] = []
  for (const [g, n] of byGroup) {
    if (n >= 2) out.push({ severity: 'info', message: `같은 ${g.toUpperCase()} 매장이 ${n}곳이에요. 하나만 가도 될까요?` })
  }
  return out
}
