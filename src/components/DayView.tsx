import { useMemo, useState } from 'react'
import type { DayConfig, DayPlan, EngineData } from '../types'
import { toMin } from '../engine'
import { buildMapGroups, googleRouteUrl } from '../lib/mapGroups'
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
  const sch = plan.schedule
  const count = plan.order.length
  const fw = day.freeWindow

  const groups = useMemo(
    () => buildMapGroups(data, day, plan, api.state, showCandidates),
    [data, day, plan, api.state, showCandidates],
  )
  const routeUrl = googleRouteUrl(data, day, plan)

  const dayFlags = sch.flags.filter((f) => !f.placeId && f.code !== 'chain-duplicate')
  const remaining = fw ? toMin(fw.returnBy) - sch.endArrive : 0

  return (
    <section aria-label={`${day.label} 동선`} className="space-y-3 px-4">
      <div>
        <p className="font-display text-xl">
          {day.city}
          {day.note && <span className="text-base font-normal text-ink-soft"> · {day.note}</span>}
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
          hint="아래 후보 목록에서 가고 싶은 곳을 체크하면 이 날 동선이 자동으로 정리돼요."
        />
      )}

      <RouteTimeline data={data} day={day} plan={plan} api={api} />

      {fw && count > 0 && (
        <Card>
          <div className="grid grid-cols-2 gap-4">
            <Stat
              label="예상 걸음"
              value={`${fmtNum(sch.totals.steps)}보`}
              sub={`목표 ${fmtNum(data.itinerary.defaults.stepsTarget)}보`}
              warn={sch.totals.steps > data.itinerary.defaults.stepsTarget}
            />
            <Stat label="이동 시간" value={fmtDur(sch.totals.travelMin)} sub={sch.totals.waitMin ? `오픈 대기 ${fmtDur(sch.totals.waitMin)}` : undefined} />
            <Stat label="교통비" value={`${fmtNum(sch.totals.fareYen)}엔`} sub="추정" />
            <Stat
              label={fw.deadlineKind === 'airport' ? '공항 출발 전 여유' : '귀가 목표까지'}
              value={remaining >= 0 ? fmtDur(remaining) : `${fmtDur(-remaining)} 초과`}
              warn={remaining < 0}
            />
          </div>
        </Card>
      )}

      {fw && (
        <div className="space-y-3 pt-2">
          <div className="flex items-center justify-between gap-3">
            <h3 className="font-display text-xl">지도</h3>
            <Chip active={showCandidates} onClick={() => setShowCandidates((v) => !v)}>
              후보도 함께 보기
            </Chip>
          </div>
          {groups.length === 0 && <p className="text-base text-ink-soft">후보를 체크하면 지도에 표시돼요.</p>}
          {groups.map((g) => (
            <div key={g.key} className="space-y-1">
              <p className="font-display text-base">{g.label.replace('-', ' · ')}</p>
              <RegionMap group={g} />
            </div>
          ))}
          {routeUrl && (
            <a href={routeUrl} target="_blank" rel="noreferrer" className="block">
              <span className="font-display flex min-h-12 w-full items-center justify-center rounded-2xl border-2 border-line bg-card text-lg">
                구글맵에서 이 동선 보기
              </span>
            </a>
          )}
        </div>
      )}
    </section>
  )
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
