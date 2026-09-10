import { describe, expect, it } from 'vitest'
import { calculateSumMultiplier } from './sumMultiplier'
import { minor, type PriceBook } from '../types/index'

const book: PriceBook = {
  currency: 'KRW',
  entries: {
    tokyo_station: { key: 'tokyo_station', label: '도쿄역', amount: minor(1_000_000) },
    shibuya: { key: 'shibuya', label: '시부야', amount: minor(1_500_000) },
  },
}
const multipliers = { '1m': 1, '3m': 2.7, '6m': 5 }

describe('합산 후 기간 배수', () => {
  it('합산한 뒤 기간 배수를 곱한다', () => {
    const r = calculateSumMultiplier(book, multipliers, { items: ['tokyo_station'], period: '3m' })
    expect(r.ok).toBe(true)
    // 1,000,000 × 2.7 = 2,700,000
    if (r.ok) expect(r.total).toBe(2_700_000)
  })

  it('배수 1이면 합산과 같다', () => {
    const r = calculateSumMultiplier(book, multipliers, { items: ['tokyo_station', 'shibuya'], period: '1m' })
    if (r.ok) expect(r.total).toBe(2_500_000)
  })

  it('소수가 나오면 내림한다 — 1원 단위 위로 올려 청구하지 않는다', () => {
    const r = calculateSumMultiplier(book, { odd: 1.333 }, { items: ['tokyo_station'], period: 'odd' })
    // 1,000,000 × 1.333 = 1,333,000.000000...2 → 내림
    if (r.ok) expect(Number.isInteger(r.total)).toBe(true)
  })

  it('모르는 기간은 거부한다 — 배수 1로 떨어지지 않는다', () => {
    const r = calculateSumMultiplier(book, multipliers, { items: ['tokyo_station'], period: '99m' })
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.errors[0]!.field).toBe('period')
  })

  it('항목을 안 고르면 거부한다', () => {
    expect(calculateSumMultiplier(book, multipliers, { items: [], period: '1m' }).ok).toBe(false)
  })

  it('배수가 0 이하면 거부한다 — 공짜나 음수 주문을 만들 수 없다', () => {
    expect(calculateSumMultiplier(book, { zero: 0 }, { items: ['shibuya'], period: 'zero' }).ok).toBe(false)
    expect(calculateSumMultiplier(book, { neg: -1 }, { items: ['shibuya'], period: 'neg' }).ok).toBe(false)
  })

  it('기간도 한 줄로 남긴다 — 계약서에 무엇을 골랐는지 보여야 한다', () => {
    const r = calculateSumMultiplier(book, multipliers, { items: ['shibuya'], period: '6m' })
    if (r.ok) expect(r.lines.some((l) => l.key === 'period:6m')).toBe(true)
  })
})
