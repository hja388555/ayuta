export type ReviewSummary = { title: string; lines: { text: string; strong: boolean }[] }

/** 결제 화면 "주문 내역 확인" — 원본 노트 순서(카테고리 → 고른 채널 → 진한 상품). 금액은 아래 총금액 바 하나로만 보인다 */
export function buildReviewSummary(pageTitle: string, unpriced: readonly { label: string; value: string }[], priced: readonly { label: string }[]): ReviewSummary {
  // 괄호는 반각(...)·전각（...） 둘 다 온다 — ja 타이틀은 전각을 쓴다("...（複数選択可）")
  const title = pageTitle.replace(/\s*[(（][^)）]*[)）]\s*$/, '').replace(/^(\d+)\.\s*/, '$1. ')
  return { title, lines: [...unpriced.map((r) => ({ text: r.value, strong: false })), ...priced.map((l) => ({ text: l.label, strong: true }))] }
}
