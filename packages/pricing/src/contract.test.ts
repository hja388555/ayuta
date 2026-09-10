import { describe, expect, it } from 'vitest'
import { fillContract, type ContractFacts } from './contract'

const facts: ContractFacts = {
  productName: '디지털광고 / SNS커뮤니티 — 스탠다드',
  country: '일본',
  channels: '인스타그램, 유튜브',
  amount: 1_000_000,
  currency: 'KRW',
  contractDate: '2026년 9월 18일',
  buyerName: '홍길동',
  signature: '홍길동',
}

describe('계약서 치환', () => {
  it('빈칸을 사실로 채운다', () => {
    const { text } = fillContract('상품: {{productName}} / 금액: {{amount}}', facts)
    expect(text).toContain('스탠다드')
    expect(text).not.toContain('{{')
  })

  it('금액은 천 단위 구분과 통화 기호로 찍는다', () => {
    const { text } = fillContract('{{amount}}', facts)
    expect(text).toBe('₩1,000,000')
  })

  it('엔화는 엔 기호로 찍는다', () => {
    const { text } = fillContract('{{amount}}', { ...facts, currency: 'JPY', amount: 150_000 })
    expect(text).toBe('¥150,000')
  })

  it('채우지 못한 빈칸을 숨기지 않고 알려준다', () => {
    const { text, missing } = fillContract('{{productName}} {{unknownKey}}', facts)
    expect(missing).toEqual(['unknownKey'])
    // 남은 빈칸을 빈 문자열로 지우면 계약서에 구멍이 뚫린 채 서명된다
    expect(text).toContain('{{unknownKey}}')
  })

  it('같은 빈칸이 여러 번 나와도 모두 채운다', () => {
    const { text } = fillContract('{{buyerName}} / {{buyerName}}', facts)
    expect(text).toBe('홍길동 / 홍길동')
  })

  it('사실에 든 값이 치환 문법을 담고 있어도 다시 치환하지 않는다', () => {
    const { text } = fillContract('{{buyerName}}', { ...facts, buyerName: '{{amount}}' })
    // 한 번만 치환한다. 재귀 치환은 주입 경로가 된다
    expect(text).toBe('{{amount}}')
  })

  it('빈칸이 없는 원문은 그대로 돌려준다', () => {
    const { text, missing } = fillContract('빈칸 없음', facts)
    expect(text).toBe('빈칸 없음')
    expect(missing).toEqual([])
  })
})
