import { describe, expect, it } from 'vitest'
import { calculateVideoPairs } from './videoPairs'
import { calculate } from '../registry'
import { minor, type PriceBook, type PricingModel } from '../types/index'

const book: PriceBook = {
  currency: 'KRW',
  entries: {
    company: { key: 'company', label: '회사 소개', amount: minor(1_000_000) },
    product: { key: 'product', label: '제품 소개', amount: minor(800_000) },
    '10m': { key: '10m', label: '10분', amount: minor(300_000) },
    '30m': { key: '30m', label: '30분', amount: minor(500_000) },
  },
}
const keys = { types: ['company', 'product'], lengths: ['10m', '30m'] }
const model: PricingModel = { kind: 'videoPairs', category: 2, ...keys }

describe('영상 종류·길이 쌍 계산', () => {
  it('쌍마다 종류 + 길이를 더하고 한 줄씩 만든다', () => {
    const r = calculateVideoPairs(book, keys, {
      pairs: [
        { type: 'company', length: '10m' },
        { type: 'product', length: '30m' },
      ],
    })
    expect(r.ok).toBe(true)
    if (!r.ok) return
    expect(r.total).toBe(1_300_000 + 1_300_000)
    expect(r.lines).toEqual([
      { key: 'company:10m', label: '회사 소개 · 10분', amount: 1_300_000 },
      { key: 'product:30m', label: '제품 소개 · 30분', amount: 1_300_000 },
    ])
  })

  it('같은 길이를 두 번 고르면 두 번 센다 — 중복 제거하지 않는다', () => {
    const r = calculateVideoPairs(book, keys, {
      pairs: [
        { type: 'company', length: '10m' },
        { type: 'product', length: '10m' },
      ],
    })
    expect(r.ok && r.total).toBe(1_300_000 + 1_100_000)
  })

  it('하나도 안 고르면 거부한다', () => {
    expect(calculateVideoPairs(book, keys, { pairs: [] }).ok).toBe(false)
  })

  it('길이가 비어 있는 쌍이 있으면 거부한다', () => {
    const r = calculateVideoPairs(book, keys, { pairs: [{ type: 'company', length: '' }] })
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.errors[0]!.field).toBe('pairs')
  })

  it('같은 종류를 두 번 보내면 거부한다', () => {
    const r = calculateVideoPairs(book, keys, {
      pairs: [
        { type: 'company', length: '10m' },
        { type: 'company', length: '30m' },
      ],
    })
    expect(r.ok).toBe(false)
  })

  it('종류 개수보다 많은 쌍은 거부한다', () => {
    const pairs = [
      { type: 'company', length: '10m' },
      { type: 'product', length: '10m' },
      { type: 'company', length: '30m' },
    ]
    expect(calculateVideoPairs(book, keys, { pairs }).ok).toBe(false)
  })

  it('종류·길이 자리가 뒤바뀌거나 모르는 키면 거부한다', () => {
    expect(calculateVideoPairs(book, keys, { pairs: [{ type: '10m', length: 'company' }] }).ok).toBe(false)
    expect(calculateVideoPairs(book, keys, { pairs: [{ type: 'nope', length: '10m' }] }).ok).toBe(false)
    expect(calculateVideoPairs(book, keys, { pairs: [{ type: 'company', length: '90m' }] }).ok).toBe(false)
  })

  it('정의에는 있지만 단가가 없는 키면 거부한다', () => {
    const r = calculateVideoPairs(book, { types: ['company', 'store'], lengths: ['10m'] }, { pairs: [{ type: 'store', length: '10m' }] })
    expect(r.ok).toBe(false)
  })
})

describe('registry — videoPairs 모양 검증', () => {
  it('pairs 가 배열이 아니거나 원소 모양이 틀리면 거부한다', () => {
    for (const bad of [null, {}, { pairs: 'x' }, { pairs: [{ type: 'company' }] }, { pairs: [{ type: 1, length: '10m' }] }, { items: ['company', '10m'] }]) {
      const r = calculate(model, book, bad)
      expect(r.ok).toBe(false)
    }
  })

  it('올바른 모양이면 계산기로 넘긴다', () => {
    const r = calculate(model, book, { pairs: [{ type: 'company', length: '30m' }], country: ['kr'] })
    expect(r.ok && r.total).toBe(1_500_000)
  })
})
