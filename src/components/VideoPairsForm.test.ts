import { describe, expect, it } from 'vitest'
import { minor, type PriceBook } from '@ayuta/pricing'
import { buildPairsQuery, pairsForSingleLength, previewPairsQuote, singleLengthFromPairs } from './VideoPairsForm'
import { selectionFromQuery } from '../lib/checkout/selection-from-query'
import { CATEGORIES } from '../lib/categories'

const model = CATEGORIES.find((c) => c.no === 2)!.model
const book: PriceBook = {
  currency: 'KRW',
  entries: {
    'video-type-company': { key: 'video-type-company', label: '회사·기업 소개', amount: minor(1_000_000) },
    'video-type-product': { key: 'video-type-product', label: '제품·상품 소개', amount: minor(900_000) },
    'video-length-10m': { key: 'video-length-10m', label: '10분', amount: minor(200_000) },
  },
}

describe('영상 종류 여러 개 + 길이 한 번 (2026-09-13)', () => {
  it('고른 종류마다 같은 길이로 쌍을 만든다', () => {
    expect(pairsForSingleLength(['video-type-company', 'video-type-event'], 'video-length-20m')).toEqual([
      { type: 'video-type-company', length: 'video-length-20m' },
      { type: 'video-type-event', length: 'video-length-20m' },
    ])
  })
  it('길이를 아직 안 골랐으면 쌍이 없다', () => {
    expect(pairsForSingleLength(['video-type-company'], undefined)).toEqual([])
  })
  it('되살릴 때 종류 목록과 첫 쌍의 길이를 쓴다', () => {
    expect(singleLengthFromPairs([{ type: 'a', length: 'x' }, { type: 'b', length: 'y' }])).toEqual({ types: ['a', 'b'], length: 'x' })
  })
  it('미리보기 금액은 종류마다 길이 값을 더한다', () => {
    // 파일 상단 픽스처: company 1,000,000 · product 900,000 · 10m 200,000
    expect(previewPairsQuote(book, model, pairsForSingleLength([], 'video-length-10m')).total).toBe(0)
    expect(previewPairsQuote(book, model, pairsForSingleLength(['video-type-company', 'video-type-product'], undefined)).total).toBe(0)
    expect(previewPairsQuote(book, model, pairsForSingleLength(['video-type-company', 'video-type-product'], 'video-length-10m')).total).toBe(1_200_000 + 1_100_000)
  })
  it('만든 쿼리를 결제 화면이 같은 쌍으로 되돌린다', () => {
    const pairs = pairsForSingleLength(['video-type-company', 'video-type-product'], 'video-length-30m')
    const qs = buildPairsQuery(pairs, ['country-jp'], ['jp'], ['brand'])
    expect(qs).not.toMatch(/amount|price|total/)
    const sp: Record<string, string | string[]> = {}
    for (const [k, v] of new URLSearchParams(qs)) {
      const prev = sp[k]
      sp[k] = prev === undefined ? v : Array.isArray(prev) ? [...prev, v] : [prev, v]
    }
    expect(selectionFromQuery(model, sp)).toEqual({ items: ['country-jp'], pairs, country: ['jp'], purpose: ['brand'] })
  })
})
