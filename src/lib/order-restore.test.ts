import { describe, expect, it } from 'vitest'
import { formFor } from './category-groups'
import { pairsFromQuery, restoreFromQuery, selectionsFromItems, tabFromItems } from './order-restore'

describe('결제 화면에서 돌아왔을 때 선택 되살리기', () => {
  it('쿼리의 반복 값·단일 값을 목록으로 읽는다', () => {
    expect(restoreFromQuery({ item: ['a', 'b'], tier: 'basic', period: '1w', size: ['x'] })).toEqual({
      items: ['a', 'b'],
      pairs: [],
      tiers: ['basic'],
      platforms: [],
      period: '1w',
      size: undefined,
    })
  })

  it('4번: 항목을 묶음별로 나누고 폼에 없는 키는 버린다', () => {
    const f = formFor(4)!
    expect(selectionsFromItems(f, ['subway-city-seoul', 'subway-city-busan', 'subway-spot-door-side', 'nope'])).toEqual({
      subwayCity: ['subway-city-seoul', 'subway-city-busan'],
      subwaySpot: ['subway-spot-door-side'],
    })
  })

  it('4번: 포스터 "제작 안함"은 혼자만 남는다', () => {
    const f = formFor(4)!
    expect(selectionsFromItems(f, ['poster-skip', 'poster-digital'])).toEqual({ posterBillboard: ['poster-skip'] })
    expect(selectionsFromItems(f, ['poster-digital', 'poster-skip'])).toEqual({ posterBillboard: ['poster-skip'] })
  })

  it('나라가 정해진 첫 항목으로 탭을 고른다', () => {
    const f = formFor(4)!
    expect(tabFromItems(f, ['subway-spot-door-side', 'subway-city-tokyo'])).toBe('jp')
    expect(tabFromItems(f, ['subway-spot-door-side'])).toBeNull()
  })

  it('2번: 올바른 쌍만, 같은 종류는 처음 것만 되살린다', () => {
    const f = formFor(2)!
    expect(
      pairsFromQuery(f, [
        'video-type-company:video-length-10m',
        'video-type-product:video-length-10m',
        'video-type-company:video-length-30m',
        'video-length-10m:video-type-company',
        'video-type-event',
        'video-type-event:video-length-10m:x',
      ]),
    ).toEqual([
      { type: 'video-type-company', length: 'video-length-10m' },
      { type: 'video-type-product', length: 'video-length-10m' },
    ])
  })
})
