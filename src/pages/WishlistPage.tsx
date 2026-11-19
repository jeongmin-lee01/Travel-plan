import EmptyState from '../components/EmptyState'
import PageHeader from '../components/PageHeader'

export default function WishlistPage() {
  return (
    <>
      <PageHeader title="위시리스트" sub="사고 싶은 물건을 매장별로 모아 둬요" />
      <EmptyState title="비어 있어요" hint="사고 싶은 물건을 추가하면 매장별 합계를 볼 수 있어요." />
    </>
  )
}
