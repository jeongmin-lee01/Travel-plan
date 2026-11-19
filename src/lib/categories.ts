/** 후보 카테고리는 이 4가지로만 보여준다 */
export const CATEGORIES = ['굿즈', '의류', '식당', '기타'] as const
export type Category = (typeof CATEGORIES)[number]

/** places.json에 조사해 둔 세부 분류 → 4가지 카테고리. 게임센터는 모두 굿즈 */
const MAP: Record<string, Category> = {
  '애니메이션 굿즈': '굿즈',
  '트레이딩카드': '굿즈',
  '게임센터': '굿즈',
  '게임센터·굿즈': '굿즈',
  '중고 굿즈': '굿즈',
  '캐릭터 굿즈': '굿즈',
  '수집용품': '굿즈',
  '닌텐도 공식 매장': '굿즈',
  '포켓몬 공식 매장': '굿즈',
  '기념품점(추정)': '굿즈',
  '의류': '의류',
  '식당': '식당',
  '카페': '식당',
  // 쇼핑몰·전자제품 등은 기타
}

export function normalizeCategory(raw: string): Category {
  return (CATEGORIES as readonly string[]).includes(raw) ? (raw as Category) : (MAP[raw] ?? '기타')
}
