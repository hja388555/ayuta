// findOwnedOrder 통합 테스트 — 게스트 주문의 유일한 프라이버시 통제다.
// `pnpm seed:prices && pnpm seed:contracts`를 먼저 돌려야 한다.
import { afterAll, describe, expect, it } from 'vitest'
import { localPayload } from './helpers/localApi'
import { createOrder } from '../src/lib/checkout/create-order'
import { findOwnedOrder } from '../src/lib/order-lookup'

const RUN = Date.now()

const validOrderer = {
  name: `주문조회테스트${RUN}`,
  phone: '010-9999-0000',
  email: `order-lookup-${RUN}@example.com`,
  postalCode: '12345',
  address1: '서울특별시 동대문구 답십리동 323',
}

describe('findOwnedOrder', () => {
  const createdOrderIds: number[] = []

  afterAll(async () => {
    const payload = await localPayload()
    for (const id of createdOrderIds) {
      await payload.delete({ collection: 'orders', id, overrideAccess: true }).catch(() => {})
    }
  })

  const makeOrder = async () => {
    const result = await createOrder({
      categorySlug: 'digital-sns',
      locale: 'ko',
      selection: { tiers: ['standard'], platforms: [], country: ['kr'] },
      consents: { agree: true },
      orderer: { ...validOrderer },
      signature: validOrderer.name,
    })
    if (!result.ok) throw new Error(`테스트 주문 생성 실패: ${result.reason}`)
    createdOrderIds.push(result.orderId)
    return result
  }

  it('주문번호·이메일·연락처가 모두 맞으면 열린다', async () => {
    const order = await makeOrder()
    const found = await findOwnedOrder(order.orderNumber, { kind: 'guest', email: validOrderer.email, phone: validOrderer.phone })
    expect(found?.orderNumber).toBe(order.orderNumber)
  })

  it('연락처를 하이픈 없이 적어도 열린다 — 숫자만 비교한다', async () => {
    const order = await makeOrder()
    const found = await findOwnedOrder(order.orderNumber, { kind: 'guest', email: validOrderer.email.toUpperCase(), phone: '01099990000' })
    expect(found?.orderNumber).toBe(order.orderNumber)
  })

  it('이메일만 틀려도 남의 주문을 못 연다', async () => {
    const order = await makeOrder()
    const found = await findOwnedOrder(order.orderNumber, { kind: 'guest', email: 'someone-else@example.com', phone: validOrderer.phone })
    expect(found).toBeNull()
  })

  it('연락처만 틀려도 남의 주문을 못 연다', async () => {
    const order = await makeOrder()
    const found = await findOwnedOrder(order.orderNumber, { kind: 'guest', email: validOrderer.email, phone: '010-0000-0000' })
    expect(found).toBeNull()
  })

  it('존재하지 않는 주문번호는 null이다 — 존재 여부를 알려주는 다른 오류를 내지 않는다', async () => {
    const found = await findOwnedOrder(`AY-존재안함-${RUN}`, { kind: 'guest', email: validOrderer.email, phone: validOrderer.phone })
    expect(found).toBeNull()
  })
})
