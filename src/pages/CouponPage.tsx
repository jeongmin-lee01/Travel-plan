import EmptyState from '../components/EmptyState'
import PageHeader from '../components/PageHeader'

export default function CouponPage() {
  return (
    <>
      <PageHeader title="쿠폰" sub="계산대에서 크게 보여줄 수 있어요" />
      <EmptyState title="등록된 쿠폰이 없어요" hint="쿠폰을 등록하면 유효기간과 바코드를 한곳에서 확인할 수 있어요." />
    </>
  )
}
