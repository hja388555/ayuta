// createOrder 통합 테스트. 실제 DB(단가·계약서 템플릿)를 읽고 실제 orders 행을 만든다.
// `pnpm seed:prices && pnpm seed:contracts`를 먼저 돌려야 한다 — 1번(digital-sns)
// 단가와 1번 계약서 템플릿이 있어야 이 테스트들이 통과한다.
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { localPayload } from './helpers/localApi'
import { createOrder } from '../src/lib/checkout/create-order'

const RUN = Date.now()

const validOrderer = {
  name: `테스트고객${RUN}`,
  phone: '010-1234-5678',
  email: `test-${RUN}@example.com`,
  postalCode: '12345',
  address1: '서울특별시 동대문구 답십리동 323',
}

// 1번(digital-sns) — standard 등급 1개. scripts/seed-prices.ts 가 심는 실제 키다
const baseInput = () => ({
  categorySlug: 'digital-sns',
  locale: 'ko' as const,
  selection: { tiers: ['standard'], platforms: [] },
  consents: { agree: true },
  orderer: { ...validOrderer },
  signature: validOrderer.name,
})

describe('createOrder', () => {
  const createdOrderIds: number[] = []

  afterAll(async () => {
    const payload = await localPayload()
    for (const id of createdOrderIds) {
      await payload.delete({ collection: 'orders', id, overrideAccess: true }).catch(() => {})
    }
  })

  it('클라이언트가 보낸 금액을 쓰지 않는다 — 스키마에 금액 필드가 아예 없다', async () => {
    const withAmount = { ...baseInput(), amount: 1, total: 1, price: 1 }
    const result = await createOrder(withAmount)
    expect(result.ok).toBe(true)
    if (result.ok) {
      createdOrderIds.push(result.orderId)
      // standard 등급 DB 단가(2,000,000원)로 계산된 값이지 클라이언트가 보낸 1이 아니다
      expect(result.amount).toBe(2_000_000)
    }
  })

  it('선택 항목으로 서버가 계산한 금액이 저장된다', async () => {
    const result = await createOrder(baseInput())
    expect(result.ok).toBe(true)
    if (!result.ok) return
    createdOrderIds.push(result.orderId)

    const payload = await localPayload()
    const order = await payload.findByID({ collection: 'orders', id: result.orderId, overrideAccess: true })
    expect(order.amount).toBe(2_000_000)
    expect(order.currency).toBe('KRW')
  })

  it('필수 동의가 빠지면 주문이 만들어지지 않는다', async () => {
    const result = await createOrder({ ...baseInput(), consents: {} })
    expect(result).toEqual({ ok: false, reason: 'consent_required' })
  })

  it('정의에 없는 동의 키를 보내도 통과하지 않는다', async () => {
    // 'agree'가 아니라 클라이언트가 지어낸 키를 체크했다 — 실제 필수 키가 안 채워졌으므로 거부
    const result = await createOrder({ ...baseInput(), consents: { madeUpKey: true } })
    expect(result).toEqual({ ok: false, reason: 'consent_required' })
  })

  it('계약서 빈칸을 못 채우면(=템플릿이 없으면) 주문을 만들지 않는다', async () => {
    // 3번(press-blog)은 계약서 템플릿이 없다 — blog-note는 실제 priced 키다
    const result = await createOrder({
      categorySlug: 'press-blog',
      locale: 'ko' as const,
      selection: { items: ['blog-note'] },
      consents: {},
      orderer: { ...validOrderer },
      signature: validOrderer.name,
    })
    expect(result).toEqual({ ok: false, reason: 'no_contract' })
  })

  it('비회원도 주문할 수 있고 주문자 정보가 저장된다', async () => {
    const result = await createOrder(baseInput(), null)
    expect(result.ok).toBe(true)
    if (!result.ok) return
    createdOrderIds.push(result.orderId)

    const payload = await localPayload()
    const order = await payload.findByID({ collection: 'orders', id: result.orderId, overrideAccess: true })
    expect(order.customer).toBeFalsy()
    expect(order.orderer?.name).toBe(validOrderer.name)
    expect(order.orderer?.email).toBe(validOrderer.email)
  })

  it('주문자 정보가 비면 거부한다', async () => {
    const { orderer: _omit, ...rest } = baseInput()
    const result = await createOrder({ ...rest, orderer: { ...validOrderer, name: '' } })
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.reason).toBe('invalid_input')
  })

  it('전자서명 이름이 주문자 이름과 다르면 거부한다', async () => {
    const result = await createOrder({ ...baseInput(), signature: '다른사람' })
    expect(result).toEqual({ ok: false, reason: 'signature_mismatch' })
  })

  it('계약서 전문이 주문에 값으로 저장된다', async () => {
    const result = await createOrder(baseInput())
    expect(result.ok).toBe(true)
    if (!result.ok) return
    createdOrderIds.push(result.orderId)

    const payload = await localPayload()
    const order = await payload.findByID({ collection: 'orders', id: result.orderId, overrideAccess: true })
    expect(typeof order.contractText).toBe('string')
    expect((order.contractText as string).length).toBeGreaterThan(0)
    expect(order.contractText as string).toContain(validOrderer.name)
  })

  it('저장 후 단가를 바꿔도 그 주문의 금액과 계약서가 변하지 않는다', async () => {
    const result = await createOrder(baseInput())
    expect(result.ok).toBe(true)
    if (!result.ok) return
    createdOrderIds.push(result.orderId)

    const payload = await localPayload()
    const before = await payload.findByID({ collection: 'orders', id: result.orderId, overrideAccess: true })

    // standard 단가를 임시로 바꾼다
    const { docs } = await payload.find({
      collection: 'price-entries',
      where: { and: [{ category: { equals: 1 } }, { key: { equals: 'standard' } }] },
      overrideAccess: true,
    })
    const priceEntry = docs[0]
    if (!priceEntry) throw new Error('standard 단가 항목을 찾지 못했습니다 — pnpm seed:prices 를 먼저 실행하세요')
    const originalPriceKrw = priceEntry.priceKrw as number
    try {
      await payload.update({
        collection: 'price-entries',
        id: priceEntry.id,
        overrideAccess: true,
        data: { priceKrw: originalPriceKrw + 999_999 },
      })

      const after = await payload.findByID({ collection: 'orders', id: result.orderId, overrideAccess: true })
      expect(after.amount).toBe(before.amount)
      expect(after.contractText).toBe(before.contractText)
    } finally {
      await payload.update({
        collection: 'price-entries',
        id: priceEntry.id,
        overrideAccess: true,
        data: { priceKrw: originalPriceKrw },
      })
    }
  })

  it('같은 요청을 두 번 보내면 주문번호가 다르다', async () => {
    const r1 = await createOrder(baseInput())
    const r2 = await createOrder(baseInput())
    expect(r1.ok).toBe(true)
    expect(r2.ok).toBe(true)
    if (!r1.ok || !r2.ok) return
    createdOrderIds.push(r1.orderId, r2.orderId)
    expect(r1.orderNumber).not.toBe(r2.orderNumber)
  })
})
