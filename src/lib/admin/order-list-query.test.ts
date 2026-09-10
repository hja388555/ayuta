import { describe, expect, it } from 'vitest'
import {
  buildOrderListQuery,
  ORDER_LIST_PAGE_SIZE,
  orderListHref,
  parseOrderListParams,
} from './order-list-query'

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

  it('검색어의 앞뒤 공백을 지운다', () => {
    expect(parseOrderListParams({ q: '  AY-1  ' }).q).toBe('AY-1')
  })

  it('같은 키가 여러 번 오면 첫 값만 쓴다', () => {
    expect(parseOrderListParams({ status: ['paid', 'done'] }).status).toBe('paid')
  })
})

describe('buildOrderListQuery', () => {
  it('조건이 없으면 빈 where 를 낸다', () => {
    const q = buildOrderListQuery({ status: null, q: '', page: 1 })
    expect(q.where).toEqual({})
    expect(q.limit).toBe(ORDER_LIST_PAGE_SIZE)
    expect(q.sort).toBe('-createdAt')
  })

  it('상태 필터만 있을 때', () => {
    expect(buildOrderListQuery({ status: 'paid', q: '', page: 2 }).where).toEqual({
      and: [{ status: { equals: 'paid' } }],
    })
  })

  it('검색은 주문번호만 본다 — 이름·연락처로는 찾지 않는다', () => {
    const where = buildOrderListQuery({ status: null, q: 'AY-2609', page: 1 }).where as {
      and: Record<string, unknown>[]
    }
    expect(where.and).toEqual([{ orderNumber: { like: 'AY-2609' } }])
    expect(JSON.stringify(where)).not.toContain('orderer')
  })

  it('상태와 검색을 함께 걸면 둘 다 and 로 들어간다', () => {
    const where = buildOrderListQuery({ status: 'done', q: 'AY-1', page: 1 }).where as {
      and: Record<string, unknown>[]
    }
    expect(where.and).toHaveLength(2)
  })

  it('page 를 그대로 넘긴다', () => {
    expect(buildOrderListQuery({ status: null, q: '', page: 4 }).page).toBe(4)
  })
})

describe('orderListHref', () => {
  it('필터·검색을 유지한 채 페이지만 바꾼다', () => {
    expect(orderListHref({ status: 'paid', q: 'AY-1', page: 1 }, 3)).toBe(
      '/manage/orders?status=paid&q=AY-1&page=3',
    )
  })

  it('1페이지·조건 없음은 맨 주소로 만든다', () => {
    expect(orderListHref({ status: null, q: '', page: 5 }, 1)).toBe('/manage/orders')
  })
})
