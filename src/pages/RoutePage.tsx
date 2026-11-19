import EmptyState from '../components/EmptyState'
import PageHeader from '../components/PageHeader'

export default function RoutePage() {
  return (
    <>
      <PageHeader title="동선" sub="11/23(월) ~ 11/26(목) · 오사카·교토" />
      <EmptyState
        title="아직 일정이 없어요"
        hint="장소 조사를 마치면 날짜별 기본 일정이 여기에 채워지고, 후보를 추가하면 순서가 자동으로 정리돼요."
      />
    </>
  )
}
