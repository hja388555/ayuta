import type { Where } from 'payload'
import { ORDER_STATUSES, type OrderStatus } from '../../collections/Orders'

/** 한 페이지에 보여주는 주문 수 */
export const ORDER_LIST_PAGE_SIZE = 50

export type OrderListParams = {
  status: OrderStatus | null
  q: string
  page: number
}

export type OrderListQuery = {
  where: Where
  limit: number
  page: number
  sort: string
}

const isOrderStatus = (value: unknown): value is OrderStatus =>
  typeof value === 'string' && (ORDER_STATUSES as readonly string[]).includes(value)

const first = (value: string | string[] | undefined): string | undefined =>
  Array.isArray(value) ? value[0] : value

/**
 * URL 쿼리스트링을 화면이 쓰는 값으로 좁힌다.
 *
 * 쿼리스트링은 사용자가 손으로 고칠 수 있는 입력이다 — status 는 화이트리스트에
 * 없으면 "필터 없음"으로 떨어뜨리고(에러로 만들어 화면을 못 열게 하지 않는다),
 * page 는 1 미만·NaN 을 전부 1로 정규화한다. 여기서 정규화하지 않으면 아래
 * buildOrderListQuery 가 payload 에 음수 page 를 그대로 넘긴다.
 */
export function parseOrderListParams(sp: Record<string, string | string[] | undefined>): OrderListParams {
  const rawStatus = first(sp.status)
  const rawPage = Number(first(sp.page))
  return {
    status: isOrderStatus(rawStatus) ? rawStatus : null,
    q: (first(sp.q) ?? '').trim(),
    page: Number.isFinite(rawPage) && rawPage >= 1 ? Math.floor(rawPage) : 1,
  }
}

/**
 * payload.find 에 넘길 조회 조건을 만든다.
 *
 * 검색은 주문번호 하나만 본다. 고객 이름·연락처까지 like 로 열면 관리자 화면이
 * 개인정보 검색기가 되고, 인덱스도 타지 않는다. 조건이 하나도 없으면 빈 where 를
 * 돌려준다 — 빈 and 배열을 넘기면 어댑터에 따라 조건 없는 쿼리로 보이지 않는다.
 */
export function buildOrderListQuery(params: OrderListParams): OrderListQuery {
  const and: Where[] = []
  if (params.status) and.push({ status: { equals: params.status } })
  if (params.q) and.push({ orderNumber: { like: params.q } })

  return {
    where: and.length > 0 ? { and } : {},
    limit: ORDER_LIST_PAGE_SIZE,
    page: params.page,
    // 최근 주문이 위로. 관리자가 매일 보는 건 오늘 들어온 건이다
    sort: '-createdAt',
  }
}

/** 필터·검색을 유지한 채 페이지만 바꾼 링크를 만든다 */
export function orderListHref(params: OrderListParams, page: number): string {
  const qs = new URLSearchParams()
  if (params.status) qs.set('status', params.status)
  if (params.q) qs.set('q', params.q)
  if (page > 1) qs.set('page', String(page))
  const s = qs.toString()
  return s ? `/manage/orders?${s}` : '/manage/orders'
}
