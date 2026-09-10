import 'server-only'
import { getPayload } from 'payload'
import config from '@payload-config'
import type { Order } from '../payload-types'

export type OrderOwnershipCheck =
  | { kind: 'member'; customerId: number }
  // 비회원은 세션이 없다. 주문번호만으로 열면 번호를 추측한 남이 남의 계약서·연락처를 본다 —
  // 그래서 이메일·연락처까지 세 값이 모두 맞아야 연다 (Q21 규칙)
  | { kind: 'guest'; email: string; phone: string }

/**
 * 주문번호로 주문을 찾되, 본인 것인지 확인한 뒤에만 돌려준다.
 * 못 찾거나 본인 것이 아니면 null — 어느 쪽이든 호출자에게 "존재하지 않음"과 구분할
 * 정보를 주지 않는다(주문번호가 존재하는지 자체가 이미 정보다).
 */
export async function findOwnedOrder(orderNumber: string, check: OrderOwnershipCheck): Promise<Order | null> {
  const payload = await getPayload({ config })
  const { docs } = await payload.find({
    collection: 'orders',
    where: { orderNumber: { equals: orderNumber } },
    limit: 1,
    overrideAccess: true,
  })
  const order = docs[0] as Order | undefined
  if (!order) return null

  if (check.kind === 'member') {
    const customerId = typeof order.customer === 'number' ? order.customer : order.customer?.id
    return customerId === check.customerId ? order : null
  }

  // 비회원: customer 가 있는 주문(=회원 주문)은 게스트 경로로 못 연다
  if (order.customer) return null
  const emailMatches = order.orderer.email.trim().toLowerCase() === check.email.trim().toLowerCase()
  const phoneMatches = order.orderer.phone.trim() === check.phone.trim()
  return emailMatches && phoneMatches ? order : null
}
