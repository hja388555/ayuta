import { describe, expect, it } from 'vitest'
import { isSameOrderer, quoteAccess, quoteOrderKey, quoteOrderLines } from './quote-order'

const NOW = Date.parse('2026-09-11T00:00:00Z')

describe('견적 결제 가능 여부', () => {
  it('발행 상태이고 기간이 남았으면 결제할 수 있다', () => {
    expect(quoteAccess({ status: 'issued', expiresAt: '2026-09-12T00:00:00Z' }, NOW)).toBe('ok')
  })

  it('만료 시각이 지났거나 딱 그 시각이면 만료다', () => {
    expect(quoteAccess({ status: 'issued', expiresAt: '2026-09-10T00:00:00Z' }, NOW)).toBe('expired')
    expect(quoteAccess({ status: 'issued', expiresAt: '2026-09-11T00:00:00Z' }, NOW)).toBe('expired')
  })

  it('회수된 견적은 기간이 남아도 회수다', () => {
    expect(quoteAccess({ status: 'revoked', expiresAt: '2026-09-30T00:00:00Z' }, NOW)).toBe('revoked')
  })

  it('만료일을 못 읽으면 만료로 본다', () => {
    expect(quoteAccess({ status: 'issued', expiresAt: 'not-a-date' }, NOW)).toBe('expired')
    expect(quoteAccess({ status: 'issued' }, NOW)).toBe('expired')
  })
})

describe('견적 주문 멱등키', () => {
  it('견적 id 로만 정해진다', () => {
    expect(quoteOrderKey(12)).toBe('quote-12')
    expect(quoteOrderKey(12)).toBe(quoteOrderKey('12'))
  })
})

describe('견적 → 주문 항목', () => {
  const quote = {
    quoteNumber: 'Q-20260911-ABC123',
    lines: [
      { label: '현수막 제작', quantity: 2, unitAmount: 150_000 },
      { label: '설치', quantity: 1, unitAmount: 50_000 },
    ],
    total: 350_000,
  }

  it('금액은 견적 합계, 항목은 라인 그대로다', () => {
    const lines = quoteOrderLines(quote, ['kr'], 'ko')
    expect(lines.amount).toBe(350_000)
    expect(lines.items).toEqual([
      { code: 'quote-line-1', label: '현수막 제작', unitAmount: 150_000, quantity: 2 },
      { code: 'quote-line-2', label: '설치', unitAmount: 50_000, quantity: 1 },
    ])
  })

  it('계약서 항목은 견적번호와 수량만 담고 금액을 섞지 않는다', () => {
    const { contractItems } = quoteOrderLines(quote, ['kr'], 'ko')
    expect(contractItems).toEqual([
      { label: '견적번호', value: 'Q-20260911-ABC123' },
      { label: '현수막 제작', value: '수량 2' },
      { label: '설치', value: '수량 1' },
    ])
    expect(JSON.stringify(contractItems)).not.toMatch(/150,?000|50,?000/)
  })

  it('일본어 계약서는 일본어 라벨을 쓴다', () => {
    const { contractItems, contractFacts } = quoteOrderLines(quote, ['jp', 'kr'], 'ja')
    expect(contractItems[0]).toEqual({ label: '見積番号', value: 'Q-20260911-ABC123' })
    expect(contractItems[1]?.value).toBe('数量 2')
    expect(contractFacts.country).toBe('韓国, 日本')
  })

  it('나라는 알려진 코드만 남기고, 없으면 계약서 칸을 대시로 채운다', () => {
    const lines = quoteOrderLines(quote, ['us', 'kr'], 'ko')
    expect(lines.country).toEqual(['kr'])
    expect(quoteOrderLines(quote, [], 'ko').contractFacts).toEqual({ productName: '현수막 제작, 설치', channels: '-', country: '-' })
  })
})

describe('같은 주문자인지', () => {
  it('이메일 대소문자·공백과 연락처 하이픈은 무시한다', () => {
    expect(isSameOrderer({ email: 'Hong@Example.com ', phone: '010-1234-5678' }, { email: 'hong@example.com', phone: '01012345678' })).toBe(true)
  })

  it('이메일이나 연락처 하나라도 다르면 다른 주문자다', () => {
    expect(isSameOrderer({ email: 'a@example.com', phone: '01012345678' }, { email: 'b@example.com', phone: '01012345678' })).toBe(false)
    expect(isSameOrderer({ email: 'a@example.com', phone: '01012345678' }, { email: 'a@example.com', phone: '01099999999' })).toBe(false)
  })
})
