import { describe, expect, it } from 'vitest'
import { minor, type PriceBook, type PricingModel } from '@ayuta/pricing'
import { buildPaymentQuery, orderTiers, previewQuote, tierSummaryItems, toggleValue } from './TierForm'

const book: PriceBook = {
  currency: 'KRW',
  entries: {
    basic: { key: 'basic', label: '베이직', amount: minor(500_000) },
    standard: { key: 'standard', label: '스탠다드', amount: minor(1_000_000) },
  },
}
const model: PricingModel = { kind: 'tier', category: 1, tiers: ['basic', 'standard'], platforms: [] }

describe('상품 내용 목록 (1번)', () => {
  it('플랫폼은 한 줄로 잇고 등급은 한 줄씩', () => {
    expect(tierSummaryItems(['유튜브, 쇼츠', '틱톡 (숏폼영상)'], ['프리미엄'])).toEqual(['유튜브, 쇼츠 / 틱톡 (숏폼영상)', '프리미엄'])
  })
  it('아무것도 안 고르면 빈 목록', () => {
    expect(tierSummaryItems([], [])).toEqual([])
  })
})

describe('등급 열 순서', () => {
  it('베이직 → 스탠다드 → 프리미엄 순으로 정렬한다', () => {
    const entries = [
      { key: 'premium', label: '프리미엄', amount: minor(0) },
      { key: 'standard', label: '스탠다드', amount: minor(0) },
      { key: 'basic', label: '베이직', amount: minor(0) },
    ]
    expect(orderTiers(entries).map((e) => e.key)).toEqual(['basic', 'standard', 'premium'])
  })

  it('알 수 없는 키는 뒤로 보낸다', () => {
    const entries = [
      { key: 'mystery', label: '?', amount: minor(0) },
      { key: 'premium', label: '프리미엄', amount: minor(0) },
      { key: 'basic', label: '베이직', amount: minor(0) },
    ]
    expect(orderTiers(entries).map((e) => e.key)).toEqual(['basic', 'premium', 'mystery'])
  })
})

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

describe('미리보기 견적', () => {
  it('등급을 여러 개 고르면 합산되고 등급마다 한 줄씩 적힌다', () => {
    const q = previewQuote(book, model, ['basic', 'standard'], [])
    expect(q.total).toBe(1_500_000)
    expect(q.rows.map((r) => r.label)).toEqual(['베이직', '스탠다드'])
    expect(q.rows.every((r) => Boolean(r.amount))).toBe(true)
  })

  it('플랫폼을 아무리 골라도 금액이 변하지 않는다', () => {
    const a = previewQuote(book, model, ['standard'], []).total
    const b = previewQuote(book, model, ['standard'], ['instagram', 'youtube', 'tiktok', 'line']).total
    expect(a).toBe(b)
  })

  it('아무것도 안 고르면 빈 견적을 보여준다 — 던지지 않는다', () => {
    expect(previewQuote(book, model, [], [])).toEqual({ total: 0, rows: [] })
  })

  it('단가에 없는 등급이 섞이면 빈 견적을 보여준다 — 틀린 금액을 보여주지 않는다', () => {
    expect(previewQuote(book, model, ['standard', 'ghost'], [])).toEqual({ total: 0, rows: [] })
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
    const qs = buildPaymentQuery(['basic', 'standard'], ['instagram', 'youtube'], ['kr', 'jp'], ['brand'])
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
    const qs = buildPaymentQuery(['basic'], [], ['jp', 'kr'], ['brand'])
    const params = new URLSearchParams(qs)
    expect(params.getAll('country')).toEqual(['jp', 'kr'])
    expect(params.getAll('purpose')).toEqual(['brand'])
  })

  it('목적을 안 골랐으면 purpose param이 없다', () => {
    const qs = buildPaymentQuery(['basic'], [], ['jp'], [])
    expect(new URLSearchParams(qs).has('purpose')).toBe(false)
  })
})
