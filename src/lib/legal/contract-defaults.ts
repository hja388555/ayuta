// 관리자 화면에서 새로 만드는 계약서의 기본 동의 항목. scripts/seed-contracts.ts 의 AGREE_CONSENT_KO/JA 와 같은 문구다.
// key 'agree' 하나·필수 — 결제 검증(allRequiredChecked)과 화면이 기대하는 가장 단순한 구성이다.
export type ContractConsentDef = { key: string; label: string; required: boolean }

export const CONTRACT_CATEGORIES = [1, 2, 3, 4, 5] as const

export function defaultAgreeConsent(locale: 'ko' | 'ja'): ContractConsentDef {
  return {
    key: 'agree',
    label: locale === 'ja' ? '上記契約内容をすべて確認し、これに同意します。' : '위 계약 내용을 모두 확인하였으며 이에 동의합니다.',
    required: true,
  }
}
