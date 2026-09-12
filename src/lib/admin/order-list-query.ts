import type { Where } from 'payload'
import { ORDER_STATUSES, type OrderStatus } from '../../collections/Orders'

/** 한 페이지에 보여주는 주문 수 */
export const ORDER_LIST_PAGE_SIZE = 50

/** 기간 필터(createdAt 기준, Asia/Seoul 달력) */
export const ORDER_PERIODS = ['all', 'today', '7d', '30d', 'month'] as const
export type OrderPeriod = (typeof ORDER_PERIODS)[number]
export const PERIOD_LABELS: Record<OrderPeriod, string> = {
  all: '기간 전체',
  today: '오늘',
  '7d': '최근 7일',
  '30d': '최근 30일',
  month: '이번 달',
}

/** 검색어 상한. like 는 인덱스를 못 타므로 긴 문자열로 DB 를 붙잡지 못하게 자른다 */
const MAX_QUERY_LENGTH = 50

export type OrderListParams = {
  status: OrderStatus | null
  q: string
  page: number
  period: OrderPeriod
}

export type OrderListQuery = {
  where: Where
  limit: number
  page: number
  sort: string
}

const isOrderStatus = (value: unknown): value is OrderStatus =>
  typeof value === 'string' && (ORDER_STATUSES as readonly string[]).includes(value)

const isPeriod = (value: unknown): value is OrderPeriod =>
  typeof value === 'string' && (ORDER_PERIODS as readonly string[]).includes(value)

const first = (value: string | string[] | undefined): string | undefined =>
  Array.isArray(value) ? value[0] : value

/**
 * URL 쿼리스트링을 화면이 쓰는 값으로 좁힌다.
 *
 * 쿼리스트링은 사용자가 손으로 고칠 수 있는 입력이다 — status·period 는 화이트리스트에
 * 없으면 "필터 없음"으로 떨어뜨리고(에러로 만들어 화면을 못 열게 하지 않는다),
 * page 는 1 미만·NaN 을 전부 1로 정규화한다.
 */
export function parseOrderListParams(sp: Record<string, string | string[] | undefined>): OrderListParams {
  const rawStatus = first(sp.status)
  const rawPeriod = first(sp.period)
  const rawPage = Number(first(sp.page))
  return {
    status: isOrderStatus(rawStatus) ? rawStatus : null,
    q: (first(sp.q) ?? '').trim().slice(0, MAX_QUERY_LENGTH),
    page: Number.isFinite(rawPage) && rawPage >= 1 ? Math.floor(rawPage) : 1,
    period: isPeriod(rawPeriod) ? rawPeriod : 'all',
  }
}

const SEOUL_OFFSET_MS = 9 * 60 * 60 * 1000 // 서머타임이 없어 고정 오프셋으로 충분하다
const DAY_MS = 24 * 60 * 60 * 1000

/** 기간 필터의 시작 시각(UTC). 'all' 은 null */
export function periodStart(period: OrderPeriod, now: Date): Date | null {
  if (period === 'all') return null
  const seoul = new Date(now.getTime() + SEOUL_OFFSET_MS)
  const y = seoul.getUTCFullYear()
  const m = seoul.getUTCMonth()
  const todayStart = Date.UTC(y, m, seoul.getUTCDate()) - SEOUL_OFFSET_MS
  switch (period) {
    case 'today':
      return new Date(todayStart)
    case '7d':
      return new Date(todayStart - 6 * DAY_MS)
    case '30d':
      return new Date(todayStart - 29 * DAY_MS)
    case 'month':
      return new Date(Date.UTC(y, m, 1) - SEOUL_OFFSET_MS)
  }
}

/**
 * 목록·상태별 건수·CSV 내보내기가 함께 쓰는 조회 조건.
 *
 * 검색은 주문번호·주문자명·연락처를 like 로 본다. 이 조건은 overrideAccess: false 로
 * 세션 사용자에게만 걸리므로(orders read access = 관리자) 고객이 이 경로로 남의 이름을
 * 찾을 수는 없다. 상태 칩의 건수는 status 를 뺀 조건으로 센다(includeStatus: false).
 * 조건이 하나도 없으면 빈 where 를 돌려준다 — 빈 and 배열은 어댑터에 따라 다르게 해석된다.
 */
export function buildOrderWhere(
  params: OrderListParams,
  opts: { includeStatus?: boolean; now?: Date; phoneOrderIds?: readonly number[] } = {},
): Where {
  const and: Where[] = []
  if (params.status && opts.includeStatus !== false) and.push({ status: { equals: params.status } })
  if (params.q) {
    const or: Where[] = [
      { orderNumber: { like: params.q } },
      { 'orderer.name': { like: params.q } },
      { 'orderer.phone': { like: params.q } },
    ]
    // 연락처처럼 보이는 검색어는 하이픈·공백을 뺀 숫자로 미리 찾은 주문 id 를 함께 본다(resolvePhoneOrderIds)
    if (opts.phoneOrderIds && opts.phoneOrderIds.length > 0) or.push({ id: { in: [...opts.phoneOrderIds] } })
    and.push({ or })
  }
  const start = periodStart(params.period, opts.now ?? new Date())
  if (start) and.push({ createdAt: { greater_than_equal: start.toISOString() } })
  return and.length > 0 ? { and } : {}
}

export function buildOrderListQuery(
  params: OrderListParams,
  now: Date = new Date(),
  phoneOrderIds?: readonly number[],
): OrderListQuery {
  return {
    where: buildOrderWhere(params, { now, phoneOrderIds }),
    limit: ORDER_LIST_PAGE_SIZE,
    page: params.page,
    // 최근 주문이 위로. 관리자가 매일 보는 건 오늘 들어온 건이다
    sort: '-createdAt',
  }
}

function filterQs(params: Partial<OrderListParams>): URLSearchParams {
  const qs = new URLSearchParams()
  if (params.status) qs.set('status', params.status)
  if (params.q) qs.set('q', params.q)
  if (params.period && params.period !== 'all') qs.set('period', params.period)
  return qs
}

/** 필터·검색을 유지한 채 페이지만 바꾼 링크를 만든다 */
export function orderListHref(params: OrderListParams, page: number): string {
  const qs = filterQs(params)
  if (page > 1) qs.set('page', String(page))
  const s = qs.toString()
  return s ? `/manage/orders?${s}` : '/manage/orders'
}

/** 상태 칩 링크 — 상태만 바꾸고 검색·기간은 유지, 페이지는 1로 */
export function orderStatusHref(params: OrderListParams, status: OrderStatus | null): string {
  return orderListHref({ ...params, status }, 1)
}

/** 현재 필터 그대로 CSV 를 받는 주소 */
export function orderExportHref(params: OrderListParams): string {
  const s = filterQs(params).toString()
  return s ? `/api/admin/orders/export?${s}` : '/api/admin/orders/export'
}

/**
 * 검색어가 연락처처럼 보이면(숫자·하이픈·공백만, 숫자 3자리 이상) 숫자만 남겨 돌려준다. 아니면 null.
 * 저장된 연락처는 '010-1234-5678' 과 '01012345678' 이 섞여 있어 like 한 번으로는 서로 못 찾는다.
 */
export function phoneSearchDigits(q: string): string | null {
  if (!/^[\d\s-]+$/.test(q)) return null
  const digits = q.replace(/\D/g, '')
  return digits.length >= 3 ? digits : null
}

const ORDER_LIST_PATH = '/manage/orders'

/**
 * 상세 화면의 "목록으로" 주소. ?from= 은 사용자가 고칠 수 있는 입력이라 주문 목록 경로와
 * 그 쿼리스트링만 받는다 — 다른 경로·외부 주소(//evil.test)·역슬래시는 전부 기본 목록으로 떨어뜨린다.
 */
export function orderListBackHref(raw: unknown): string {
  if (typeof raw !== 'string' || raw.length > 500) return ORDER_LIST_PATH
  if (!raw.startsWith(ORDER_LIST_PATH)) return ORDER_LIST_PATH
  const rest = raw.slice(ORDER_LIST_PATH.length)
  if (rest !== '' && !rest.startsWith('?')) return ORDER_LIST_PATH
  if (/[\\\s]/.test(rest) || rest.includes('//')) return ORDER_LIST_PATH
  return raw
}

/** 목록 → 상세 링크. 지금 보고 있는 목록 주소를 from 으로 실어 "목록으로"가 필터·페이지를 되살린다 */
export function orderDetailHref(id: number, listHref: string): string {
  return listHref === ORDER_LIST_PATH ? `${ORDER_LIST_PATH}/${id}` : `${ORDER_LIST_PATH}/${id}?from=${encodeURIComponent(listHref)}`
}

/** 번호 페이지네이션에 보여줄 페이지 번호(현재 페이지 중심 최대 5개) */
export function pageWindow(current: number, total: number, size = 5): number[] {
  const last = Math.max(1, total)
  const start = Math.max(1, Math.min(current - Math.floor(size / 2), last - size + 1))
  const end = Math.min(last, start + size - 1)
  return Array.from({ length: end - start + 1 }, (_, i) => start + i)
}
