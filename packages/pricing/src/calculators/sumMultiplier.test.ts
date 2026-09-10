import { describe, expect, it } from 'vitest'
import { minor, type PriceBook } from '../types/index'
import { calculateSumMultiplier } from './sumMultiplier'

const book = (amounts: Record<string, number>): PriceBook => ({
  currency: 'KRW',
  entries: Object.fromEntries(Object.entries(amounts).map(([key, amount]) => [key, { key, label: key, amount: minor(amount) }])),
})

const total = (r: ReturnType<typeof calculateSumMultiplier>) => (r.ok ? r.total : null)

describe('calculateSumMultiplier — 기간 배수', () => {
  it('부동소수 오차로 1원을 잃지 않는다 (100 × 1.15 = 115)', () => {
    // 부동소수로 곱하면 114.99999999999999 → 내림 114 가 된다
    expect(total(calculateSumMultiplier(book({ a: 100 }), { '2w': 1.15 }, { items: ['a'], period: '2w' }))).toBe(115)
  })

  it('기존 임시값 그대로 계산한다 (250,000 × 1.8 = 450,000)', () => {
    expect(total(calculateSumMultiplier(book({ a: 250_000 }), { '2w': 1.8 }, { items: ['a'], period: '2w' }))).toBe(450_000)
  })

  it('나누어떨어지지 않으면 내림한다 (333 × 1.5 = 499.5 → 499)', () => {
    expect(total(calculateSumMultiplier(book({ a: 333 }), { '1m': 1.5 }, { items: ['a'], period: '1m' }))).toBe(499)
  })

  it('항목을 먼저 더한 뒤 배수를 곱한다', () => {
    expect(total(calculateSumMultiplier(book({ a: 100_000, b: 50_000 }), { '3m': 8 }, { items: ['a', 'b'], period: '3m' }))).toBe(1_200_000)
  })

  it('소수 셋째 자리 배수는 거부한다 — 조용히 반올림하지 않는다', () => {
    const r = calculateSumMultiplier(book({ a: 100 }), { '2w': 1.125 }, { items: ['a'], period: '2w' })
    expect(r.ok).toBe(false)
  })

  it('모르는 기간·0·음수 배수는 거부한다', () => {
    const b = book({ a: 100 })
    expect(calculateSumMultiplier(b, { '1w': 1 }, { items: ['a'], period: '6m' }).ok).toBe(false)
    expect(calculateSumMultiplier(b, { '1w': 0 }, { items: ['a'], period: '1w' }).ok).toBe(false)
    expect(calculateSumMultiplier(b, { '1w': -1 }, { items: ['a'], period: '1w' }).ok).toBe(false)
  })
})
