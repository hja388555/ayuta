import { describe, expect, it } from 'vitest'
import { calculateTier } from './tier'
import { minor, type PriceBook } from '../types/index'

const book: PriceBook = {
  currency: 'KRW',
  entries: {
    basic: { key: 'basic', label: '베이직', amount: minor(1_000_000) },
    standard: { key: 'standard', label: '스탠다드', amount: minor(2_000_000) },
    premium: { key: 'premium', label: '프리미엄', amount: minor(3_000_000) },
  },
}

describe('1번 등급 계산', () => {
  it('등급 하나를 고르면 그 단가가 총액이 된다', () => {
    const r = calculateTier(book, { tiers: ['standard'], platforms: [] })
    expect(r.ok).toBe(true)
    if (!r.ok) return
    expect(r.total).toBe(2_000_000)
    expect(r.lines).toHaveLength(1)
  })

  it('등급을 여러 개 고르면 금액이 합산된다', () => {
    const r = calculateTier(book, { tiers: ['standard', 'premium'], platforms: [] })
    expect(r.ok).toBe(true)
    if (!r.ok) return
    expect(r.total).toBe(5_000_000)
    expect(r.lines.map((l) => l.label)).toEqual(['스탠다드', '프리미엄'])
  })

  it('플랫폼을 아무리 골라도 금액이 변하지 않는다', () => {
    const a = calculateTier(book, { tiers: ['basic'], platforms: [] })
    const b = calculateTier(book, {
      tiers: ['basic'],
      platforms: ['instagram', 'youtube', 'tiktok', 'line'],
    })
    expect(a.ok && b.ok && a.total === b.total).toBe(true)
  })

  it('등급을 하나도 안 고르면 거부한다', () => {
    const r = calculateTier(book, { tiers: [], platforms: ['instagram'] })
    expect(r.ok).toBe(false)
    if (r.ok) return
    expect(r.errors[0]?.field).toBe('tiers')
  })

  it('등록되지 않은 등급이 오면 거부한다', () => {
    const r = calculateTier(book, { tiers: ['platinum'], platforms: [] })
    expect(r.ok).toBe(false)
  })

  it('주문에 복사할 라벨과 금액을 함께 돌려준다', () => {
    const r = calculateTier(book, { tiers: ['premium'], platforms: [] })
    if (!r.ok) throw new Error('계산 실패')
    expect(r.lines[0]).toEqual({ key: 'premium', label: '프리미엄', amount: 3_000_000 })
  })
})
