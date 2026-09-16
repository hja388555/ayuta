import { describe, expect, it } from 'vitest'
import { quoteContractIssue, type ConsentDraft } from './quote-contract'

const consent = (over: Partial<ConsentDraft> = {}): ConsentDraft => ({
  key: 'agree',
  labelKo: '위 계약 내용에 동의합니다.',
  labelJa: '上記契約内容に同意します。',
  required: true,
  ...over,
})

describe('견적 계약서 입력 검증', () => {
  it('발행형 서비스는 제목·본문이 비면 거부한다', () => {
    expect(quoteContractIssue('perQuote', { title: '', body: '내용', consents: [consent()] })).toBe('contract_required')
    expect(quoteContractIssue('perQuote', { title: '계약서', body: '   ', consents: [consent()] })).toBe('contract_required')
  })

  it('동의 항목은 최소 한 줄이 필요하다', () => {
    expect(quoteContractIssue('perQuote', { title: '계약서', body: '내용', consents: [] })).toBe('consent_required')
  })

  it('필수 동의가 하나도 없으면 거부한다', () => {
    // 전부 선택 항목이면 아무 동의 없이 결제가 끝난다 — 동의가 빠진 계약서가 된다
    expect(
      quoteContractIssue('perQuote', { title: '계약서', body: '내용', consents: [consent({ required: false })] }),
    ).toBe('consent_required')
  })

  it('모양이 갖춰지면 통과한다', () => {
    expect(quoteContractIssue('perQuote', { title: '계약서', body: '내용', consents: [consent()] })).toBeNull()
  })

  it('동의 키가 겹치면 거부한다', () => {
    // 키가 같으면 고객이 무엇에 동의했는지 주문 기록에서 갈라낼 수 없다
    expect(
      quoteContractIssue('perQuote', {
        title: '계약서',
        body: '내용',
        consents: [consent(), consent({ labelKo: '다른 문구' })],
      }),
    ).toBe('consent_duplicate')
  })

  it('키 모양이 어긋나거나 문구가 비면 거부한다', () => {
    expect(quoteContractIssue('perQuote', { title: '계약서', body: '내용', consents: [consent({ key: 'Agree' })] })).toBe('consent_invalid')
    expect(quoteContractIssue('perQuote', { title: '계약서', body: '내용', consents: [consent({ key: '1st' })] })).toBe('consent_invalid')
    expect(quoteContractIssue('perQuote', { title: '계약서', body: '내용', consents: [consent({ labelJa: '' })] })).toBe('consent_invalid')
  })

  it('고정 계약서를 쓰는 서비스는 입력이 없어도 된다', () => {
    expect(quoteContractIssue('fixed', { title: '', body: '', consents: [] })).toBeNull()
  })
})
