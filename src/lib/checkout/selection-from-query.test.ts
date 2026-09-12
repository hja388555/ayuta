import { describe, expect, it } from 'vitest'
import { calculate, minor, type PriceBook, type PricingModel } from '@ayuta/pricing'
import { selectionFromQuery, filterPricedSelection } from './selection-from-query'
import { formFor } from '../category-groups'

// C1 회귀 테스트 — 견적 화면 쿼리(가격 있는 선택 + 없는 선택)가 결제 직전 화면을 거쳐
// 실제 결제 가능한 selection으로 안 잃어버리고 살아남는지 본다. filterPricedSelection은
// calculate() 직전 한 번만 걸려야 한다(계약서로 가는 값에는 걸면 안 된다) — 그 성질을
// 여기서 확인한다.
describe('selectionFromQuery', () => {
  it('sum 모델 — priced 항목뿐 아니라 size(가격 없는 자유 입력)도 담는다', () => {
    const model: PricingModel = { kind: 'sum', category: 2, groups: [] }
    const sel = selectionFromQuery(model, { item: ['video-type-company', 'country-kr'], size: '가로 2m' }) as {
      items: string[]
      size?: string
    }
    expect(sel.items).toEqual(['video-type-company', 'country-kr'])
    expect(sel.size).toBe('가로 2m')
  })

  it('sumMultiplier 모델도 size를 담는다', () => {
    const model: PricingModel = { kind: 'sumMultiplier', category: 4, items: [], multipliers: { '1w': 1 } }
    const sel = selectionFromQuery(model, { item: ['subway-city-seoul'], period: '1w', size: '1200x800' }) as {
      items: string[]
      period: string
      size?: string
    }
    expect(sel.size).toBe('1200x800')
    expect(sel.period).toBe('1w')
  })
})

describe('selectionFromQuery — 표지 나라·목적은 카테고리와 무관하게 실린다', () => {
  it('tier 모델(1번)도 country·purpose를 담는다', () => {
    const model: PricingModel = { kind: 'tier', category: 1, tiers: [], platforms: [] }
    const sel = selectionFromQuery(model, { tier: ['standard'], country: ['jp', 'kr'], purpose: 'brand' }) as {
      country: string[]
      purpose?: string
    }
    expect(sel.country).toEqual(['jp', 'kr'])
    expect(sel.purpose).toBe('brand')
  })

  it('목적을 아예 안 골랐으면 undefined다 — 목적은 선택이다', () => {
    const model: PricingModel = { kind: 'tier', category: 1, tiers: [], platforms: [] }
    const sel = selectionFromQuery(model, { tier: ['standard'], country: ['jp'] }) as { purpose?: string }
    expect(sel.purpose).toBeUndefined()
  })

  it('country·purpose가 섞여 들어가도 calculate()는 깨지지 않는다 — 필요한 키만 본다', () => {
    const model: PricingModel = { kind: 'tier', category: 1, tiers: [], platforms: [] }
    const sel = selectionFromQuery(model, { tier: ['standard'], country: ['jp'], purpose: 'brand' })
    const book: PriceBook = { currency: 'KRW', entries: { standard: { key: 'standard', label: '스탠다드', amount: minor(500000) } } }
    const r = calculate(model, book, sel)
    expect(r.ok).toBe(true)
  })
})

describe('filterPricedSelection — priced/unpriced 분리는 계산 직전에만 건다', () => {
  it('국가(가격 없음) 같은 선택은 calculate용 selection에서만 빠지고, 원본 selection에는 남아 있다', () => {
    const model: PricingModel = { kind: 'sum', category: 2, groups: [] }
    const form = formFor(2)
    const rawSelection = selectionFromQuery(model, { item: ['video-type-company', 'country-kr'], size: '' })

    // 원본은 그대로다 — createOrder가 계약서를 만들 때 이걸 쓴다
    expect((rawSelection as { items: string[] }).items).toContain('country-kr')

    // calculate()로 가는 쪽만 걸러진다
    const pricedSelection = filterPricedSelection(model, form, rawSelection) as { items: string[] }
    expect(pricedSelection.items).not.toContain('country-kr')
    expect(pricedSelection.items).toContain('video-type-company')
  })
})

describe('selectionFromQuery — 2번 videoPairs', () => {
  const keysOf = (group: string) => formFor(2)!.groups.find((g) => g.key === group)!.items.map((i) => i.key)
  const model: PricingModel = { kind: 'videoPairs', category: 2, types: keysOf('videoType'), lengths: keysOf('videoLength') }

  it('pair=종류:길이 를 순서대로 쌍으로 되돌리고, item=(촬영 국가)은 따로 담는다', () => {
    const sel = selectionFromQuery(model, {
      item: 'country-kr',
      pair: ['video-type-company:video-length-10m', 'video-type-product:video-length-10m'],
      country: 'kr',
    })
    expect(sel).toEqual({
      items: ['country-kr'],
      pairs: [
        { type: 'video-type-company', length: 'video-length-10m' },
        { type: 'video-type-product', length: 'video-length-10m' },
      ],
      country: ['kr'],
      purpose: undefined,
    })
  })

  it('콜론이 없는 pair 는 길이가 빈 쌍이 되어 계산에서 거부된다', () => {
    const sel = selectionFromQuery(model, { pair: 'video-type-company' }) as { pairs: unknown }
    expect(sel.pairs).toEqual([{ type: 'video-type-company', length: '' }])
  })

  it('옛 주소(item=종류&item=길이 하나씩)는 쌍 하나로 받는다', () => {
    const sel = selectionFromQuery(model, { item: ['country-jp', 'video-type-event', 'video-length-20m'] }) as { pairs: unknown }
    expect(sel.pairs).toEqual([{ type: 'video-type-event', length: 'video-length-20m' }])
  })

  it('옛 주소라도 종류·길이가 하나씩이 아니면 쌍을 만들지 않는다', () => {
    const sel = selectionFromQuery(model, { item: ['video-type-event', 'video-type-store', 'video-length-20m'] }) as { pairs: unknown }
    expect(sel.pairs).toEqual([])
  })

  it('filterPricedSelection 은 쌍만 남긴다', () => {
    const raw = selectionFromQuery(model, { item: 'country-kr', pair: 'video-type-company:video-length-10m', country: 'kr' })
    expect(filterPricedSelection(model, formFor(2), raw)).toEqual({ pairs: [{ type: 'video-type-company', length: 'video-length-10m' }] })
  })
})
