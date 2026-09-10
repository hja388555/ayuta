/** 정수 최소단위 금액. 원 = 1. float 금지 */
export type Minor = number & { readonly __brand: 'Minor' }

export const minor = (n: number): Minor => {
  if (!Number.isInteger(n)) throw new Error(`금액은 정수여야 합니다: ${n}`)
  if (n < 0) throw new Error(`금액은 음수일 수 없습니다: ${n}`)
  return n as Minor
}

export type Currency = 'KRW' | 'JPY'

/** 관리자가 입력한 단가 한 건 */
export type PriceEntry = {
  /** 항목 식별자. 카테고리 안에서 유일하다 */
  key: string
  /** 화면과 계약서에 그대로 찍히는 이름 */
  label: string
  amount: Minor
}

/** 계산에 필요한 단가 묶음. 호출하는 쪽이 DB에서 읽어 넘긴다 */
export type PriceBook = {
  currency: Currency
  entries: Record<string, PriceEntry>
}

export type PricingModel =
  | { kind: 'tier'; category: 1; tiers: string[]; platforms: string[] }
  // 2번(현지 영상 제작)은 조합형이 아니라 합산이다 — 촬영 국가 · 영상 종류 · 영상 길이가
  // 각각 금액칸을 가지고 고른 것을 더한다. 원래 matrix로 선언돼 있던 것을 정정했다
  | { kind: 'sum'; category: 2 | 3; groups: { key: string; items: string[] }[] }
  | { kind: 'sumMultiplier'; category: 4; items: string[]; multipliers: Record<string, number> }
  | { kind: 'inquiry'; category: 5 }

/** 주문에 값으로 복사되는 한 줄. 단가가 나중에 바뀌어도 이 값은 변하지 않는다 */
export type QuoteLine = {
  key: string
  label: string
  amount: Minor
}

export type QuoteOk = {
  ok: true
  lines: QuoteLine[]
  total: Minor
  currency: Currency
}

export type QuoteError = {
  ok: false
  errors: { field: string; message: string }[]
}

export type QuoteResult = QuoteOk | QuoteError
