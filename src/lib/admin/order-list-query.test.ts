import { describe, expect, it } from 'vitest'
import {
  buildOrderListQuery,
  buildOrderWhere,
  ORDER_LIST_PAGE_SIZE,
  orderExportHref,
  orderListHref,
  pageWindow,
  parseOrderListParams,
  periodStart,
  type OrderListParams,
} from './order-list-query'

const P = (over: Partial<OrderListParams> = {}): OrderListParams => ({
  status: null,
  q: '',
  page: 1,
  period: 'all',
  ...over,
})

describe('parseOrderListParams', () => {
  it('화이트리스트에 있는 상태만 필터로 인정한다', () => {
    expect(parseOrderListParams({ status: 'paid' }).status).toBe('paid')
    expect(parseOrderListParams({ status: 'drop table' }).status).toBeNull()
    expect(parseOrderListParams({}).status).toBeNull()
  })

  it('page 를 1 이상 정수로 정규화한다', () => {
    expect(parseOrderListParams({ page: '3' }).page).toBe(3)
    expect(parseOrderListParams({ page: '0' }).page).toBe(1)
    expect(parseOrderListParams({ page: '-2' }).page).toBe(1)
    expect(parseOrderListParams({ page: 'abc' }).page).toBe(1)
    expect(parseOrderListParams({ page: '2.7' }).page).toBe(2)
  })

  it('검색어의 앞뒤 공백을 지우고 길이를 자른다', () => {
    expect(parseOrderListParams({ q: '  AY-1  ' }).q).toBe('AY-1')
    expect(parseOrderListParams({ q: 'x'.repeat(200) }).q).toHaveLength(50)
  })

  it('같은 키가 여러 번 오면 첫 값만 쓴다', () => {
    expect(parseOrderListParams({ status: ['paid', 'done'] }).status).toBe('paid')
  })

  it('기간은 화이트리스트 밖이면 전체다', () => {
    expect(parseOrderListParams({ period: '7d' }).period).toBe('7d')
    expect(parseOrderListParams({ period: '999d' }).period).toBe('all')
  })
})

describe('buildOrderListQuery', () => {
  it('조건이 없으면 빈 where 를 낸다', () => {
    const q = buildOrderListQuery(P())
    expect(q.where).toEqual({})
    expect(q.limit).toBe(ORDER_LIST_PAGE_SIZE)
    expect(q.sort).toBe('-createdAt')
  })

  it('상태 필터만 있을 때', () => {
    expect(buildOrderListQuery(P({ status: 'paid', page: 2 })).where).toEqual({
      and: [{ status: { equals: 'paid' } }],
    })
  })

  it('검색은 주문번호·주문자명·연락처를 or 로 본다', () => {
    const where = buildOrderListQuery(P({ q: 'AY-2609' })).where
    expect(where).toEqual({
      and: [
        {
          or: [
            { orderNumber: { like: 'AY-2609' } },
            { 'orderer.name': { like: 'AY-2609' } },
            { 'orderer.phone': { like: 'AY-2609' } },
          ],
        },
      ],
    })
  })

  it('상태와 검색을 함께 걸면 둘 다 and 로 들어간다', () => {
    const where = buildOrderListQuery(P({ status: 'done', q: 'AY-1' })).where as { and: unknown[] }
    expect(where.and).toHaveLength(2)
  })

  it('상태 칩 건수용 조건에는 상태가 빠진다', () => {
    expect(buildOrderWhere(P({ status: 'done' }), { includeStatus: false })).toEqual({})
  })

  it('기간은 createdAt 하한으로 들어간다', () => {
    const now = new Date('2026-09-18T05:00:00Z')
    const where = buildOrderListQuery(P({ period: 'today' }), now).where
    expect(where).toEqual({ and: [{ createdAt: { greater_than_equal: '2026-09-17T15:00:00.000Z' } }] })
  })

  it('page 를 그대로 넘긴다', () => {
    expect(buildOrderListQuery(P({ page: 4 })).page).toBe(4)
  })
})

describe('periodStart', () => {
  // 서울 2026-09-18 00:30 = UTC 09-17 15:30
  const now = new Date('2026-09-17T15:30:00Z')
  it('서울 달력 기준으로 자른다', () => {
    expect(periodStart('today', now)?.toISOString()).toBe('2026-09-17T15:00:00.000Z')
    expect(periodStart('7d', now)?.toISOString()).toBe('2026-09-11T15:00:00.000Z')
    expect(periodStart('30d', now)?.toISOString()).toBe('2026-08-19T15:00:00.000Z')
    expect(periodStart('month', now)?.toISOString()).toBe('2026-08-31T15:00:00.000Z')
    expect(periodStart('all', now)).toBeNull()
  })
})

describe('orderListHref', () => {
  it('필터·검색을 유지한 채 페이지만 바꾼다', () => {
    expect(orderListHref(P({ status: 'paid', q: 'AY-1', period: '7d' }), 3)).toBe(
      '/manage/orders?status=paid&q=AY-1&period=7d&page=3',
    )
  })

  it('1페이지·조건 없음은 맨 주소로 만든다', () => {
    expect(orderListHref(P({ page: 5 }), 1)).toBe('/manage/orders')
  })

  it('내보내기 주소는 같은 필터를 싣고 page 는 뺀다', () => {
    expect(orderExportHref(P({ status: 'done', page: 3 }))).toBe('/api/admin/orders/export?status=done')
  })
})

describe('pageWindow', () => {
  it('현재 페이지를 가운데 두고 최대 5개', () => {
    expect(pageWindow(1, 1)).toEqual([1])
    expect(pageWindow(1, 10)).toEqual([1, 2, 3, 4, 5])
    expect(pageWindow(6, 10)).toEqual([4, 5, 6, 7, 8])
    expect(pageWindow(10, 10)).toEqual([6, 7, 8, 9, 10])
    expect(pageWindow(1, 0)).toEqual([1])
  })
})
