import { describe, expect, it } from 'vitest'
import { minor, type PriceBook, type PricingModel } from '@ayuta/pricing'
import { buildPaymentQuery, previewTotal, toggleValue } from './TierForm'

const book: PriceBook = {
  currency: 'KRW',
  entries: {
    basic: { key: 'basic', label: '베이직', amount: minor(500_000) },
    standard: { key: 'standard', label: '스탠다드', amount: minor(1_000_000) },
  },
}
const model: PricingModel = { kind: 'tier', category: 1, tiers: ['basic', 'standard'], platforms: [] }

describe('선택 토글', () => {
  it('없으면 넣고 있으면 뺀다', () => {
    expect(toggleValue([], 'a')).toEqual(['a'])
    expect(toggleValue(['a'], 'a')).toEqual([])
    expect(toggleValue(['a'], 'b')).toEqual(['a', 'b'])
  })

  it('원본을 바꾸지 않는다', () => {
    const before = ['a']
    toggleValue(before, 'b')
    expect(before).toEqual(['a'])
  })
})

describe('미리보기 금액', () => {
  it('등급을 여러 개 고르면 합산된다', () => {
    expect(previewTotal(book, model, ['basic', 'standard'], [])).toBe(1_500_000)
  })

  it('플랫폼을 아무리 골라도 금액이 변하지 않는다', () => {
    const a = previewTotal(book, model, ['standard'], [])
    const b = previewTotal(book, model, ['standard'], ['instagram', 'youtube', 'tiktok', 'line'])
    expect(a).toBe(b)
  })

  it('아무것도 안 고르면 0을 보여준다 — 던지지 않는다', () => {
    expect(previewTotal(book, model, [], [])).toBe(0)
  })

  it('단가에 없는 등급이 섞이면 0을 보여준다 — 틀린 금액을 보여주지 않는다', () => {
    expect(previewTotal(book, model, ['standard', 'ghost'], [])).toBe(0)
  })
})

describe('결제 쿼리 빌드', () => {
  it('선택한 등급과 플랫폼을 repeated param으로 포함한다', () => {
    const qs = buildPaymentQuery(['basic', 'standard'], ['instagram', 'youtube'])
    // URLSearchParams.toString() 결과는 알파벳 순서 보장 안 함; 파싱으로 검증
    const params = new URLSearchParams(qs)
    expect(params.getAll('tier')).toEqual(['basic', 'standard'])
    expect(params.getAll('platform')).toEqual(['instagram', 'youtube'])
  })

  it('허락된 선택 키만 담는다 — tier, platform, country, purpose만 들어간다', () => {
    const qs = buildPaymentQuery(['basic', 'standard'], ['instagram', 'youtube'], ['kr', 'jp'], 'brand')
    const params = new URLSearchParams(qs)
    const allKeys = new Set(params.keys())
    // 허락된 키는 정확히 이것들만이다
    const permittedKeys = new Set(['tier', 'platform', 'country', 'purpose'])
    expect(allKeys).toEqual(permittedKeys)
  })

  it('아무것도 선택하지 않으면 빈 문자열을 반환한다', () => {
    const qs = buildPaymentQuery([], [])
    expect(qs).toBe('')
  })

  it('등급만 선택하면 플랫폼 param은 없다', () => {
    const qs = buildPaymentQuery(['basic'], [])
    const params = new URLSearchParams(qs)
    expect(params.getAll('tier')).toEqual(['basic'])
    expect(params.getAll('platform')).toEqual([])
  })

  it('플랫폼만 선택하면 등급 param은 없다', () => {
    const qs = buildPaymentQuery([], ['instagram'])
    const params = new URLSearchParams(qs)
    expect(params.getAll('tier')).toEqual([])
    expect(params.getAll('platform')).toEqual(['instagram'])
  })

  it('표지에서 고른 나라·목적을 그대로 실어 보낸다', () => {
    const qs = buildPaymentQuery(['basic'], [], ['jp', 'kr'], 'brand')
    const params = new URLSearchParams(qs)
    expect(params.getAll('country')).toEqual(['jp', 'kr'])
    expect(params.get('purpose')).toBe('brand')
  })

  it('목적을 안 골랐으면 purpose param이 없다', () => {
    const qs = buildPaymentQuery(['basic'], [], ['jp'], undefined)
    expect(new URLSearchParams(qs).has('purpose')).toBe(false)
  })
})
