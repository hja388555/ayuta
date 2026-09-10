import { describe, expect, it } from 'vitest'
import { calculateSum } from './sum'
import { minor, type PriceBook } from '../types/index'

const book: PriceBook = {
  currency: 'KRW',
  entries: {
    yomiuri: { key: 'yomiuri', label: '요미우리', amount: minor(2_000_000) },
    asahi: { key: 'asahi', label: '아사히', amount: minor(1_500_000) },
    blog: { key: 'blog', label: '블로그', amount: minor(300_000) },
  },
}

describe('합산 계산', () => {
  it('고른 항목의 단가를 더한다', () => {
    const r = calculateSum(book, { items: ['yomiuri', 'blog'] })
    expect(r.ok).toBe(true)
    if (r.ok) {
      expect(r.total).toBe(2_300_000)
      expect(r.lines.map((l) => l.key)).toEqual(['yomiuri', 'blog'])
    }
  })

  it('하나도 안 고르면 거부한다', () => {
    expect(calculateSum(book, { items: [] }).ok).toBe(false)
  })

  it('단가에 없는 항목이 섞이면 거부한다 — 조용히 빼고 계산하지 않는다', () => {
    const r = calculateSum(book, { items: ['yomiuri', 'nonexistent'] })
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.errors[0]!.field).toBe('items')
  })

  it('같은 항목을 두 번 보내도 한 번만 센다', () => {
    const r = calculateSum(book, { items: ['blog', 'blog'] })
    if (r.ok) {
      expect(r.total).toBe(300_000)
      expect(r.lines).toHaveLength(1)
    }
  })

  it('항목이 많아도 합계가 정확하다 — 부동소수점 오차가 없다', () => {
    const r = calculateSum(book, { items: ['yomiuri', 'asahi', 'blog'] })
    if (r.ok) expect(r.total).toBe(3_800_000)
  })

  it('통화는 단가 묶음의 것을 따른다', () => {
    const r = calculateSum({ ...book, currency: 'JPY' }, { items: ['blog'] })
    if (r.ok) expect(r.currency).toBe('JPY')
  })
})
