import { describe, expect, it } from 'vitest'
import { calculate } from '../registry'
import type { PriceBook, PricingModel } from './index'
import { minor } from './index'

// 관리자가 만든 서비스는 6번부터 번호를 받는다(2026-09-16). 계산 모델이 1~5만 받으면
// 새 서비스는 견적을 낼 수 없다 — 번호가 타입으로 박혀 있던 것을 푼 뒤에도
// 기존 계산이 그대로인지 여기서 붙잡는다.
const book: PriceBook = {
  currency: 'KRW',
  entries: {
    's6-spot-1': { key: 's6-spot-1', label: '강남역 전광판', amount: minor(3_000_000) },
    's6-spot-2': { key: 's6-spot-2', label: '홍대입구 전광판', amount: minor(2_500_000) },
  },
}

describe('번호 제한 없는 계산 모델', () => {
  it('6번 서비스도 항목 합산으로 계산한다', () => {
    const model: PricingModel = { kind: 'sum', category: 6, groups: [{ key: 'spot', items: ['s6-spot-1', 's6-spot-2'] }] }
    const r = calculate(model, book, { items: ['s6-spot-1', 's6-spot-2'] })
    expect(r.ok).toBe(true)
    if (r.ok) {
      expect(r.total).toBe(5_500_000)
      expect(r.lines.map((l) => l.label)).toEqual(['강남역 전광판', '홍대입구 전광판'])
    }
  })

  it('7번 서비스의 문의형은 번호가 커져도 견적 발행을 요구한다', () => {
    // 문의형은 금액이 정해지지 않았다 — 성공을 돌려주면 0 원 주문이 만들어진다(inquiry.ts)
    const model: PricingModel = { kind: 'inquiry', category: 7 }
    const r = calculate(model, book, {})
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.errors[0]?.field).toBe('category')
  })

  it('번호가 커져도 단가 없는 항목은 그대로 거부한다', () => {
    const model: PricingModel = { kind: 'sum', category: 9, groups: [{ key: 'spot', items: ['s9-none'] }] }
    const r = calculate(model, book, { items: ['s9-none'] })
    expect(r.ok).toBe(false)
  })
})
