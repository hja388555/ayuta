import { describe, expect, it } from 'vitest'
import { formFor } from './category-groups'
import { restoreFromQuery, selectionsFromItems } from './order-restore'
import { selectionHref } from './order-url'
import { buildPaymentQuery } from '../components/TierForm'
import { buildGroupQuery } from '../components/GroupForm'
import { buildPairsQuery } from '../components/VideoPairsForm'

// 주소창에 옮겨 적은 쿼리를 새로고침 때 페이지가 읽는 모양(searchParams 객체)으로 되돌린다
const reread = (href: string) => {
  const sp: Record<string, string | string[]> = {}
  for (const [k, v] of new URL(href, 'http://x').searchParams) {
    const prev = sp[k]
    sp[k] = prev === undefined ? v : Array.isArray(prev) ? [...prev, v] : [prev, v]
  }
  return restoreFromQuery(sp)
}

describe('폼 선택을 주소에 옮겨 적기', () => {
  it('쿼리가 없으면 경로만 둔다', () => {
    expect(selectionHref('/ko/order/transit', '')).toBe('/ko/order/transit')
  })

  it('1번: 옮겨 적은 등급·플랫폼을 새로고침 때 그대로 되살린다', () => {
    const href = selectionHref('/ko/order/digital-sns', buildPaymentQuery(['basic', 'premium'], ['youtube'], ['kr'], 'store'))
    const r = reread(href)
    expect(r.tiers).toEqual(['basic', 'premium'])
    expect(r.platforms).toEqual(['youtube'])
  })

  it('4번: 항목·기간·사이즈를 되살린다', () => {
    const items = ['subway-city-seoul', 'subway-spot-door-side', 'poster-skip']
    const href = selectionHref('/ja/order/transit', buildGroupQuery(items, '2w', ' 1200x800 ', 50, ['kr', 'jp']))
    const r = reread(href)
    expect(r.period).toBe('2w')
    expect(r.size).toBe('1200x800')
    expect(selectionsFromItems(formFor(4)!, r.items)).toEqual({
      subwayCity: ['subway-city-seoul'],
      subwaySpot: ['subway-spot-door-side'],
      posterBillboard: ['poster-skip'],
    })
  })

  it('2번: 촬영 국가와 영상 쌍을 되살린다', () => {
    const href = selectionHref('/ko/order/local-video', buildPairsQuery([{ type: 'video-type-company', length: 'video-length-10m' }], ['country-kr'], ['kr']))
    const r = reread(href)
    expect(r.items).toEqual(['country-kr'])
    expect(r.pairs).toEqual(['video-type-company:video-length-10m'])
  })
})
