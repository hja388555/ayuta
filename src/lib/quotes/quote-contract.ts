/**
 * 견적 발행 때 관리자가 쓰는 계약서 문구·동의 항목 검증(2026-09-16, Q53).
 *
 * 5번처럼 고정 계약서가 없는 서비스(contractMode: 'perQuote')는 견적마다 문구가 다르다.
 * 발행 순간의 문구와 동의 항목을 그 견적에 붙여 두고, 발행 뒤에는 바꾸지 않는다 —
 * 고객이 읽고 동의한 글과 나중에 보이는 글이 달라지면 계약서가 아니다.
 *
 * 고정 계약서를 쓰는 서비스는 여기서 아무것도 요구하지 않는다(관리자 화면이 입력 칸을 숨긴다).
 */
export type ConsentDraft = { key: string; labelKo: string; labelJa: string; required: boolean }
export type ContractDraft = { title: string; body: string; consents: ConsentDraft[] }

export type ContractIssueProblem = 'contract_required' | 'consent_required' | 'consent_invalid' | 'consent_duplicate'

const KEY_PATTERN = /^[a-z][a-z0-9-]{0,39}$/

export function quoteContractIssue(
  contractMode: 'fixed' | 'perQuote',
  draft: ContractDraft,
): ContractIssueProblem | null {
  if (contractMode !== 'perQuote') return null

  if (!draft.title.trim() || !draft.body.trim()) return 'contract_required'
  if (draft.consents.length === 0) return 'consent_required'

  const seen = new Set<string>()
  for (const c of draft.consents) {
    if (!KEY_PATTERN.test(c.key)) return 'consent_invalid'
    if (!c.labelKo.trim() || !c.labelJa.trim()) return 'consent_invalid'
    // 키가 겹치면 고객이 무엇에 동의했는지 주문 기록에서 갈라낼 수 없다
    if (seen.has(c.key)) return 'consent_duplicate'
    seen.add(c.key)
  }

  // 전부 선택 항목이면 아무 동의 없이도 결제가 끝난다 — 계약 동의가 빠진 계약서가 된다
  if (!draft.consents.some((c) => c.required)) return 'consent_required'
  return null
}
