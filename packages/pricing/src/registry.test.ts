import { describe, expect, it } from 'vitest'
import { calculate } from './registry'
import { minor, type PriceBook, type PricingModel } from './types/index'

const book: PriceBook = {
  currency: 'KRW',
  entries: {
    standard: { key: 'standard', label: '스탠다드', amount: minor(1_000_000) },
    'seoul__30s': { key: 'seoul__30s', label: '서울 30초', amount: minor(3_000_000) },
    blog: { key: 'blog', label: '블로그', amount: minor(300_000) },
  },
}

describe('레지스트리', () => {
  it('tier 모델을 tier 계산기로 보낸다', () => {
    const model: PricingModel = { kind: 'tier', category: 1, tiers: ['standard'], platforms: [] }
    const r = calculate(model, book, { tiers: ['standard'], platforms: ['instagram'] })
    expect(r.ok).toBe(true)
    if (r.ok) expect(r.total).toBe(1_000_000)
  })

  it('2번(sum) 모델도 sum 계산기로 보낸다 — 2번은 조합형이 아니라 합산이다', () => {
    const model: PricingModel = { kind: 'sum', category: 2, groups: [] }
    const r = calculate(model, book, { items: ['standard'] })
    expect(r.ok).toBe(true)
    if (r.ok) expect(r.total).toBe(1_000_000)
  })

  it('sum 모델을 sum 계산기로 보낸다', () => {
    const model: PricingModel = { kind: 'sum', category: 3, groups: [] }
    const r = calculate(model, book, { items: ['blog'] })
    if (r.ok) expect(r.total).toBe(300_000)
  })

  it('inquiry 모델은 금액을 만들지 않는다 — 0원 주문이 생기면 안 된다', () => {
    const model: PricingModel = { kind: 'inquiry', category: 5 }
    const r = calculate(model, book, {})
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.errors[0]!.message).toContain('견적')
  })

  it('선택값 모양이 모델과 안 맞으면 거부한다 — 던지지 않는다', () => {
    const model: PricingModel = { kind: 'sum', category: 3, groups: [] }
    for (const bad of [
      null,
      undefined,
      'x',
      42,
      [],
      { items: 'blog' },
      { items: [1, 2] },
      { tiers: null },
      // __proto__를 데이터 프로퍼티로 심어 프로토타입 오염을 시도하는 모양 —
      // HTTP 바디를 그대로 받게 될 이 레지스트리가 이런 입력에도 던지지 않고
      // 거부(ok:false)로만 응답해야 한다.
      JSON.parse('{"__proto__": {"polluted": true}}'),
    ]) {
      const r = calculate(model, book, bad)
      expect(r.ok).toBe(false)
    }
  })

  it('플랫폼을 아무리 골라도 1번 금액은 변하지 않는다', () => {
    const model: PricingModel = { kind: 'tier', category: 1, tiers: ['standard'], platforms: [] }
    const a = calculate(model, book, { tiers: ['standard'], platforms: [] })
    const b = calculate(model, book, { tiers: ['standard'], platforms: ['instagram', 'youtube', 'tiktok', 'line'] })
    expect(a.ok && b.ok && a.total === b.total).toBe(true)
  })
})
