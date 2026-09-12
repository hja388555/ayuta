import 'server-only'
import { headers } from 'next/headers'
import { getPayload, type Where } from 'payload'
import config from '@payload-config'
import type { OrderStatus } from '../../collections/Orders'
import type { Order, OrderNote, OrderTransition } from '../../payload-types'
import { phoneSearchDigits, type OrderListQuery } from './order-list-query'

/**
 * 관리자 화면·관리자 API가 데이터를 읽는 유일한 통로.
 *
 * overrideAccess 를 쓰지 않고 세션 사용자로 조회한다 — 컬렉션의 read access 가
 * isAdminRole 로 잠겨 있으므로, 이 경로로 새 화면을 붙여도 관리자 아닌 세션에는
 * 아무것도 나가지 않는다. overrideAccess: true 로 열어 두면 그 잠금이 화면마다
 * 다시 검증해야 하는 것이 되고, 한 군데만 빠뜨려도 고객 개인정보가 새 나간다.
 *
 * 게이트(requireAdmin)는 별개다 — 그건 "들어올 수 있는가"이고 여기는
 * "무엇이 보이는가"다. 호출자는 둘 다 통과시켜야 한다.
 */
export async function authedPayload() {
  const payload = await getPayload({ config })
  const { user } = await payload.auth({ headers: await headers() })
  return { payload, user }
}

export type OrderListResult = {
  docs: Order[]
  page: number
  totalPages: number
  totalDocs: number
}

export async function findOrdersForAdmin(query: OrderListQuery): Promise<OrderListResult> {
  const { payload, user } = await authedPayload()
  const res = await payload.find({
    collection: 'orders',
    where: query.where,
    limit: query.limit,
    page: query.page,
    sort: query.sort,
    // 목록에는 관계 필드를 펼칠 이유가 없다 — 조인만 늘어난다
    depth: 0,
    user,
    overrideAccess: false,
  })
  return {
    docs: res.docs as Order[],
    page: res.page ?? 1,
    totalPages: res.totalPages ?? 1,
    totalDocs: res.totalDocs ?? 0,
  }
}

/**
 * 상태 칩 건수. where 는 상태 조건을 뺀 목록 조건(검색·기간)이다.
 * 목록과 같은 세션 사용자·access 로 센다 — 건수만 따로 overrideAccess 로 열지 않는다.
 */
export async function countOrdersByStatus(
  where: Where,
  statuses: readonly OrderStatus[],
): Promise<{ total: number; byStatus: Record<string, number> }> {
  const { payload, user } = await authedPayload()
  const count = async (w: Where) =>
    (await payload.count({ collection: 'orders', where: w, user, overrideAccess: false })).totalDocs
  const and = (extra: Where): Where => (Object.keys(where).length > 0 ? { and: [where, extra] } : extra)
  const [total, ...each] = await Promise.all([
    count(where),
    ...statuses.map((s) => count(and({ status: { equals: s } }))),
  ])
  return { total, byStatus: Object.fromEntries(statuses.map((s, i) => [s, each[i] ?? 0])) }
}

/** 연락처 숫자 검색으로 모을 주문 id 상한. 목록·CSV 한 번에 보는 양보다 넉넉하게 */
const PHONE_SEARCH_LIMIT = 5000

/**
 * 연락처처럼 보이는 검색어면 하이픈·공백을 뺀 숫자로 주문 id 를 찾는다. 아니면 undefined.
 * Payload where 로는 저장값을 정규화해 비교할 수 없어 SQL 로 id 만 뽑는다 — 뽑은 id 는 다시
 * 세션 사용자(overrideAccess: false) 조회의 조건으로만 쓰이므로 access 를 우회하지 않는다.
 * digits 는 숫자뿐이라 LIKE 와일드카드가 섞일 수 없다.
 */
export async function resolvePhoneOrderIds(q: string): Promise<number[] | undefined> {
  const digits = phoneSearchDigits(q)
  if (!digits) return undefined
  const payload = await getPayload({ config })
  const { rows } = await payload.db.pool.query(
    `SELECT id FROM orders WHERE regexp_replace(orderer_phone, '[^0-9]', '', 'g') LIKE $1 ORDER BY id DESC LIMIT ${PHONE_SEARCH_LIMIT}`,
    [`%${digits}%`],
  )
  return rows.map((r: { id: number }) => Number(r.id))
}

/** CSV 내보내기 상한. 이보다 많으면 기간을 좁혀 받게 한다 — 한 요청이 DB 를 오래 붙잡지 않게 */
export const ORDER_EXPORT_LIMIT = 5000

export async function findOrdersForExport(where: Where): Promise<Order[]> {
  const { payload, user } = await authedPayload()
  const res = await payload.find({
    collection: 'orders',
    where,
    limit: ORDER_EXPORT_LIMIT,
    sort: '-createdAt',
    depth: 0,
    pagination: false,
    user,
    overrideAccess: false,
  })
  return res.docs as Order[]
}

/** 없거나 권한이 없으면 null. 둘을 구분해 알려주지 않는다 — 호출자는 양쪽 다 404 로 만든다 */
export async function findOrderForAdmin(id: number): Promise<Order | null> {
  const { payload, user } = await authedPayload()
  try {
    const doc = await payload.findByID({ collection: 'orders', id, depth: 0, user, overrideAccess: false })
    return (doc as Order) ?? null
  } catch {
    return null
  }
}

export async function findOrderNotes(orderId: number): Promise<OrderNote[]> {
  const { payload, user } = await authedPayload()
  const res = await payload.find({
    collection: 'order-notes',
    where: { order: { equals: orderId } },
    sort: '-createdAt', // 최신순 — 운영자가 마지막으로 뭘 안내했는지가 제일 먼저 필요하다
    limit: 200,
    depth: 1, // author 이메일을 보여주려면 관계를 한 단계 펼쳐야 한다
    user,
    overrideAccess: false,
  })
  return res.docs as OrderNote[]
}

export async function findOrderTransitions(orderId: number): Promise<OrderTransition[]> {
  const { payload, user } = await authedPayload()
  const res = await payload.find({
    collection: 'order-transitions',
    where: { order: { equals: orderId } },
    sort: '-at',
    limit: 200,
    depth: 1,
    user,
    overrideAccess: false,
  })
  return res.docs as OrderTransition[]
}
