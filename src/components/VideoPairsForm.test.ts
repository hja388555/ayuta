import { describe, expect, it } from 'vitest'
import { minor, type PriceBook } from '@ayuta/pricing'
import { buildPairsQuery, canPayPairs, completedPairs, pickLength, previewPairsTotal, toggleVideoType } from './VideoPairsForm'
import { selectionFromQuery } from '../lib/checkout/selection-from-query'
import { CATEGORIES } from '../lib/categories'

const model = CATEGORIES.find((c) => c.no === 2)!.model
const book: PriceBook = {
  currency: 'KRW',
  entries: {
    'video-type-company': { key: 'video-type-company', label: '회사·기업 소개', amount: minor(1_000_000) },
    'video-type-product': { key: 'video-type-product', label: '제품·상품 소개', amount: minor(900_000) },
    'video-length-10m': { key: 'video-length-10m', label: '10분', amount: minor(200_000) },
    'video-length-30m': { key: 'video-length-30m', label: '30분', amount: minor(400_000) },
  },
}

describe('영상 종류·길이 쌍 고르기', () => {
  it('종류를 고른 순서대로 쌓고, 끄면 그 종류의 길이도 사라진다', () => {
    let pairs = toggleVideoType([], 'video-type-company')
    pairs = toggleVideoType(pairs, 'video-type-product')
    pairs = pickLength(pairs, 'video-type-company', 'video-length-10m')
    expect(pairs).toEqual([{ type: 'video-type-company', length: 'video-length-10m' }, { type: 'video-type-product' }])
    pairs = toggleVideoType(pairs, 'video-type-company')
    expect(pairs).toEqual([{ type: 'video-type-product' }])
    // 다시 켜도 옛 길이가 되살아나지 않는다
    expect(toggleVideoType(pairs, 'video-type-company')[1]).toEqual({ type: 'video-type-company' })
  })

  it('길이를 다시 고르면 바뀐다 — 종류마다 하나뿐이다', () => {
    const pairs = pickLength([{ type: 'video-type-company', length: 'video-length-10m' }], 'video-type-company', 'video-length-30m')
    expect(pairs).toEqual([{ type: 'video-type-company', length: 'video-length-30m' }])
  })

  it('종류가 없거나 길이가 빠진 종류가 있으면 결제할 수 없다', () => {
    expect(canPayPairs([])).toBe(false)
    expect(canPayPairs([{ type: 'video-type-company', length: 'video-length-10m' }, { type: 'video-type-product' }])).toBe(false)
    expect(canPayPairs([{ type: 'video-type-company', length: 'video-length-10m' }])).toBe(true)
  })

  it('미리보기 금액은 길이까지 정한 쌍만 센다 — 같은 길이는 두 번 센다', () => {
    expect(previewPairsTotal(book, model, [])).toBe(0)
    expect(previewPairsTotal(book, model, [{ type: 'video-type-company' }])).toBe(0)
    const pairs = [
      { type: 'video-type-company', length: 'video-length-10m' },
      { type: 'video-type-product', length: 'video-length-10m' },
      { type: 'video-type-store' },
    ]
    expect(completedPairs(pairs)).toHaveLength(2)
    expect(previewPairsTotal(book, model, pairs)).toBe(1_200_000 + 1_100_000)
  })

  it('만든 쿼리를 결제 화면이 같은 쌍으로 되돌린다', () => {
    const pairs = [
      { type: 'video-type-company', length: 'video-length-10m' },
      { type: 'video-type-product', length: 'video-length-30m' },
    ]
    const qs = buildPairsQuery(pairs, ['country-jp'], ['jp'], 'brand')
    expect(qs).not.toMatch(/amount|price|total/)
    const sp: Record<string, string | string[]> = {}
    for (const [k, v] of new URLSearchParams(qs)) {
      const prev = sp[k]
      sp[k] = prev === undefined ? v : Array.isArray(prev) ? [...prev, v] : [prev, v]
    }
    expect(selectionFromQuery(model, sp)).toEqual({ items: ['country-jp'], pairs, country: ['jp'], purpose: 'brand' })
  })
})
