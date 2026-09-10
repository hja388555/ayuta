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
 * 비회원 소유권 판정만 뽑아낸 순수 함수 — DB를 몰라 order-lookup.test.ts 가 DB 없이
 * 이 함수를 직접 테스트할 수 있다.
 *
 * `order.orderer`가 없는 행(예: Ruling 16의 백필 이전 레거시 데이터, 혹은 데이터
 * 오염)을 단정하고 `.email`을 바로 읽으면 여기서 그대로 던진다 — 그 예외가 API
 * 응답으로 새 나가면 "그 주문번호가 존재는 한다"는 정보를 공격자에게 준다. 없는
 * 주문과 똑같이 "본인 것이 아님"으로 처리한다.
 */
type OwnershipRow = {
  customer?: Order['customer']
  // Order['orderer']는 group 필드라 여러 필수 서브필드를 요구한다 — 여기서 진짜로 보는
  // 값은 email·phone뿐이고, "orderer 자체가 없는 행"을 테스트하려면 그 값이 아예 없는
  // 상태를 표현할 수 있어야 한다. 그래서 Order['orderer']를 그대로 쓰지 않고 필요한
  // 필드만 가진 구조적 타입을 쓴다 — 실제 Order는 구조적으로 호환된다
  orderer: { email: string; phone: string } | null | undefined
}

export function guestOwnershipMatches(order: OwnershipRow, check: { email: string; phone: string }): boolean {
  if (order.customer) return false
  if (!order.orderer) return false
  const emailMatches = order.orderer.email?.trim().toLowerCase() === check.email.trim().toLowerCase()
  const phoneMatches = order.orderer.phone?.trim() === check.phone.trim()
  return Boolean(emailMatches && phoneMatches)
}

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

  return guestOwnershipMatches(order, check) ? order : null
}
