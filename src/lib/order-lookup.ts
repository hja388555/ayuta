import 'server-only'
import { getPayload } from 'payload'
import config from '@payload-config'
import type { Order } from '../payload-types'
import { toSeoulDay } from './orders/schedule'

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

/** 연락처 비교용 — 숫자만 남긴다. 주문 때 "010-1234-5678", 조회 때 "01012345678"로 적어도 같은 번호다 */
export function phoneDigits(phone: string | null | undefined): string {
  return (phone ?? '').replace(/\D/g, '')
}

export function guestOwnershipMatches(order: OwnershipRow, check: { email: string; phone: string }): boolean {
  if (order.customer) return false
  if (!order.orderer) return false
  const emailMatches = order.orderer.email?.trim().toLowerCase() === check.email.trim().toLowerCase()
  // 숫자가 하나도 없으면 빈 문자열끼리 같아지므로 막는다
  const digits = phoneDigits(check.phone)
  const phoneMatches = digits.length > 0 && phoneDigits(order.orderer.phone) === digits
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

/**
 * 고객 화면에 쓸 계약기간·광고시작일 표기.
 *
 * 계약서 스냅샷(contractText)에는 이 값이 들어 있지 않다(결제 시점엔 아직 협의 전이다).
 * 스냅샷을 사후에 고치지 않는 대신 여기서 별도 컬럼을 읽어 합성한다 — 화면에 보이는
 * 계약기간과 서명된 문서가 따로 놀지 않게 하려면 합성 지점이 한 곳이어야 한다.
 *
 * 아직 정해지지 않은 값은 `pending`("협의 중" / "協議中")으로 표시한다. 문구 자체는
 * messages/{ko,ja}.json 이 갖고 있고(next-intl), 이 함수는 번역된 문자열을 받기만 한다 —
 * 서버 유틸이 로케일 분기를 들고 있으면 문구가 두 곳으로 갈라진다.
 * 날짜는 로케일과 무관한 YYYY-MM-DD 로 낸다(Asia/Seoul 기준 그날).
 */
type ScheduleRow = {
  contractStart?: string | null
  contractEnd?: string | null
  adStartDate?: string | null
}

export function formatOrderSchedule(
  order: ScheduleRow,
  pending: string,
): { contractPeriod: string; adStartDate: string } {
  const day = (value: string | null | undefined) => toSeoulDay(value ?? null) ?? null
  const start = day(order.contractStart)
  const end = day(order.contractEnd)

  return {
    // 한쪽만 정해진 상태도 그대로 보여준다 — 정해진 절반을 숨기면 고객이 확인할 수 없다
    contractPeriod: start || end ? `${start ?? pending} ~ ${end ?? pending}` : pending,
    adStartDate: day(order.adStartDate) ?? pending,
  }
}
