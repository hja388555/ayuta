import { beforeAll, describe, expect, it } from 'vitest'
// localApi를 먼저 import 한다 — .env를 process.env에 채우는 부수효과가 있고,
// order-state.ts가 모듈 최상단에서 payload.config를 정적 import 하므로 순서가 바뀌면
// PAYLOAD_SECRET이 비어 있는 채로 설정이 평가된다.
import { localPayload } from './helpers/localApi'
import { canTransition, transitionOrder } from '../src/lib/order-state'

describe('전이표', () => {
  it('허용된 전이만 참이다', () => {
    expect(canTransition('pending', 'paid')).toBe(true)
    expect(canTransition('paid', 'in_progress')).toBe(true)
    expect(canTransition('in_progress', 'done')).toBe(true)
  })

  it('완료된 주문을 되돌릴 수 없다', () => {
    expect(canTransition('done', 'pending')).toBe(false)
    expect(canTransition('done', 'paid')).toBe(false)
  })

  it('결제되지 않은 주문을 진행중으로 만들 수 없다', () => {
    expect(canTransition('pending', 'in_progress')).toBe(false)
  })

  it('같은 상태로의 전이는 거부한다 — 중복 처리를 전이로 감추지 않는다', () => {
    for (const s of ['pending', 'paid', 'done'] as const) expect(canTransition(s, s)).toBe(false)
  })

  it('모르는 상태는 거부한다', () => {
    expect(canTransition('pending', 'nonsense' as never)).toBe(false)
    expect(canTransition('nonsense' as never, 'paid')).toBe(false)
  })
})

describe('상태 전이 (DB)', () => {
  const RUN = Date.now()

  const createOrder = async (status: 'pending' | 'paid' = 'pending') => {
    const payload = await localPayload()
    const order = await payload.create({
      collection: 'orders',
      overrideAccess: true,
      data: {
        orderNumber: `AY-TEST-${RUN}-${Math.random().toString(36).slice(2, 8)}`,
        paymentId: `pay-${RUN}-${Math.random().toString(36).slice(2, 8)}`,
        status,
        currency: 'KRW',
        amount: 100_000,
        locale: 'ko',
        category: 1,
        items: [{ code: 'standard', label: '스탠다드', unitAmount: 100_000, quantity: 1 }],
        orderer: {
          name: '홍길동',
          phone: '010-1234-5678',
          email: 'hong@example.com',
          postcode: '12345',
          address1: '서울특별시 동대문구 답십리동 323',
        },
        signature: '홍길동',
        contractText: '테스트용 계약서 전문',
      },
    })
    return order.id as number
  }

  it('허용된 전이는 상태를 바꾸고 기록을 남긴다', async () => {
    const payload = await localPayload()
    const orderId = await createOrder('pending')

    const ok = await transitionOrder(orderId, 'paid', null)
    expect(ok).toBe(true)

    const after = await payload.findByID({ collection: 'orders', id: orderId, overrideAccess: true })
    expect(after.status).toBe('paid')

    const { docs } = await payload.find({
      collection: 'order-transitions',
      where: { order: { equals: orderId } },
      overrideAccess: true,
    })
    expect(docs).toHaveLength(1)
    expect(docs[0]?.fromStatus).toBe('pending')
    expect(docs[0]?.toStatus).toBe('paid')
  })

  it('허용되지 않은 전이는 거부되고 상태가 그대로다 — 기록도 남지 않는다', async () => {
    const payload = await localPayload()
    const orderId = await createOrder('pending')

    const ok = await transitionOrder(orderId, 'in_progress', null)
    expect(ok).toBe(false)

    const after = await payload.findByID({ collection: 'orders', id: orderId, overrideAccess: true })
    expect(after.status).toBe('pending')

    const { docs } = await payload.find({
      collection: 'order-transitions',
      where: { order: { equals: orderId } },
      overrideAccess: true,
    })
    expect(docs).toHaveLength(0)
  })

  it('같은 전이를 동시에 두 번 보내면 하나만 참이고 기록도 하나만 생긴다', async () => {
    const payload = await localPayload()
    const orderId = await createOrder('pending')

    const [a, b] = await Promise.all([
      transitionOrder(orderId, 'paid', null),
      transitionOrder(orderId, 'paid', null),
    ])
    // 정확히 하나만 참이다
    expect([a, b].filter(Boolean)).toHaveLength(1)

    const { docs } = await payload.find({
      collection: 'order-transitions',
      where: { order: { equals: orderId } },
      overrideAccess: true,
    })
    expect(docs).toHaveLength(1)
  })
})
