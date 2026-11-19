import Badge from '../components/Badge'
import Button from '../components/Button'
import { Card, Ticket } from '../components/Card'
import Input from '../components/Input'
import MapMarker from '../components/MapMarker'
import PageHeader from '../components/PageHeader'

const COLORS = [
  ['paper', '#FBF6EC'],
  ['card', '#FFFDF8'],
  ['ink', '#2B2118'],
  ['accent', '#E0702B'],
  ['danger', '#C62828'],
  ['warn', '#E8A317'],
  ['reserve', '#6D4AA8'],
  ['ok', '#2F7D4A'],
]

export default function DesignPreview() {
  return (
    <div className="pb-10">
      <PageHeader title="디자인 미리보기" sub="주소 끝에 #design 을 붙이면 보여요" />
      <div className="space-y-6 px-4">
        <section className="grid grid-cols-4 gap-2">
          {COLORS.map(([n, c]) => (
            <div key={n} className="text-center text-[0.8125rem]">
              <div className="h-10 rounded-xl border-2 border-line" style={{ background: c }} />
              {n}
            </div>
          ))}
        </section>
        <section className="space-y-3">
          <Ticket time="09:00" until="10:30" locked>
            <p className="font-display text-xl">숙소 출발</p>
            <p className="text-ink-soft">신사이바시 · 짐 맡기기</p>
          </Ticket>
          <Ticket time="11:00" until="12:00">
            <p className="font-display text-xl">포켓몬센터 교토</p>
            <p className="mb-2 text-ink-soft">다음 장소까지 전철 12분 · 230엔</p>
            <div className="flex flex-wrap gap-1.5">
              <Badge tone="closed">휴무</Badge>
              <Badge tone="hours">영업시간 확인</Badge>
              <Badge tone="reserve">예약 필요</Badge>
              <Badge tone="note">확인 필요</Badge>
              <Badge tone="ok">완료</Badge>
            </div>
          </Ticket>
        </section>
        <section className="flex flex-wrap gap-2">
          <Button>동선에 추가</Button>
          <Button variant="secondary">취소</Button>
          <Button variant="ghost">자세히</Button>
        </section>
        <section className="flex items-center gap-3">
          <MapMarker kind="fixed" n={1} />
          <MapMarker kind="route" n={2} />
          <MapMarker kind="candidate" />
        </section>
        <Card>
          <Input label="상품명" placeholder="예: 포켓몬 인형" />
        </Card>
      </div>
    </div>
  )
}
