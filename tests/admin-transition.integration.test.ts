// 상태 변경 전용 경로(POST /api/admin/orders/transition)의 권한·전이 규칙을
// 실제 서버·DB 앞에서 고정한다. 단위 테스트로는 세션 게이트가 검증되지 않는다.
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { api, login } from './helpers/server.js'
import { localPayload } from './helpers/localApi.js'

const RUN = Date.now()
const PW = 'Ayuta!Test-2026'
const CUSTOMER = { email: `tr-cust+${RUN}@ayuta.test`, password: PW }
const MANAGER = { email: `tr-mgr+${RUN}@ayuta.test`, password: PW }
const SUPER = { email: `tr-super+${RUN}@ayuta.test`, password: PW }

const base = { name: '홍길동', phone: '010-0000-0000', postalCode: '00000', address1: '서울시' }

const userIds: number[] = []
const orderIds: number[] = []

let customerToken: string | undefined
let managerToken: string | undefined
let superToken: string | undefined

const ENDPOINT = '/api/admin/orders/transition'

const post = (body: unknown, token?: string) =>
  api(ENDPOINT, {
    method: 'POST',
    headers: token ? { Authorization: `JWT ${token}` } : {},
    body: JSON.stringify(body),
  })

const createOrder = async (status: 'pending' | 'paid' | 'done') => {
  const payload = await localPayload()
  const order = await payload.create({
    collection: 'orders',
    overrideAccess: true,
    data: {
      orderNumber: `AY-TR-${RUN}-${Math.random().toString(36).slice(2, 8)}`,
      paymentId: `pay-tr-${RUN}-${Math.random().toString(36).slice(2, 8)}`,
      status,
      currency: 'KRW',
      amount: 100_000,
      locale: 'ko',
      category: 1,
      items: [{ code: 'standard', label: '스탠다드', unitAmount: 100_000, quantity: 1 }],
      contractItems: [{ label: '등급', value: '스탠다드' }],
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
  const id = order.id as number
  orderIds.push(id)
  return id
}

const transitionCount = async (orderId: number) => {
  const payload = await localPayload()
  const { docs } = await payload.find({
    collection: 'order-transitions',
    where: { order: { equals: orderId } },
    overrideAccess: true,
  })
  return docs.length
}

beforeAll(async () => {
  const payload = await localPayload()
  for (const [creds, role] of [
    [CUSTOMER, 'customer'],
    [MANAGER, 'manager'],
    [SUPER, 'super'],
  ] as const) {
    const created = await payload.create({
      collection: 'users',
      data: { ...creds, ...base, role },
      overrideAccess: true,
      // role을 실제로 심으려면 훅의 명시적 탈출구가 필요하다(auth 통합 테스트와 동일)
      context: { allowRoleAssignment: true },
    })
    userIds.push(created.id as number)
  }

  customerToken = (await login(CUSTOMER.email, CUSTOMER.password)).token
  managerToken = (await login(MANAGER.email, MANAGER.password)).token
  superToken = (await login(SUPER.email, SUPER.password)).token
  expect(customerToken && managerToken && superToken).toBeTruthy()
})

afterAll(async () => {
  const payload = await localPayload()
  const errors: string[] = []
  for (const id of orderIds) {
    // 전이 기록이 주문을 참조하므로 먼저 지운다
    const { docs } = await payload.find({
      collection: 'order-transitions',
      where: { order: { equals: id } },
      overrideAccess: true,
    })
    for (const doc of docs) {
      await payload
        .delete({ collection: 'order-transitions', id: doc.id, overrideAccess: true })
        .catch((err) => errors.push(`transition id=${doc.id}: ${String(err)}`))
    }
    await payload
      .delete({ collection: 'orders', id, overrideAccess: true })
      .catch((err) => errors.push(`order id=${id}: ${String(err)}`))
  }
  for (const id of userIds) {
    await payload
      .delete({ collection: 'users', id, overrideAccess: true })
      .catch((err) => errors.push(`user id=${id}: ${String(err)}`))
  }
  // 정리 실패를 삼키면 "두 번 연속 실행해도 통과한다"는 성질이 조용히 깨진다
  if (errors.length > 0) throw new Error(`테스트 데이터 정리 실패:\n${errors.join('\n')}`)
})

describe('POST /api/admin/orders/transition', () => {
  it('비로그인은 401이다', async () => {
    const orderId = await createOrder('paid')
    const res = await post({ orderId, to: 'in_progress' })
    expect(res.status).toBe(401)
    expect(await transitionCount(orderId)).toBe(0)
  })

  it('로그인한 고객은 403이다', async () => {
    const orderId = await createOrder('paid')
    const res = await post({ orderId, to: 'in_progress' }, customerToken)
    expect(res.status).toBe(403)
    expect(await transitionCount(orderId)).toBe(0)
  })

  it('manager는 paid → in_progress 를 통과시키고 전이 기록이 1행 남는다', async () => {
    const payload = await localPayload()
    const orderId = await createOrder('paid')

    const res = await post({ orderId, to: 'in_progress', reason: '작업 착수' }, managerToken)
    expect(res.status).toBe(200)

    const after = await payload.findByID({ collection: 'orders', id: orderId, overrideAccess: true })
    expect(after.status).toBe('in_progress')
    expect(await transitionCount(orderId)).toBe(1)
  })

  it('전이표에 없는 전이(done → paid)는 409 invalid_transition 이다', async () => {
    const payload = await localPayload()
    const orderId = await createOrder('done')

    const res = await post({ orderId, to: 'paid' }, managerToken)
    expect(res.status).toBe(409)
    expect(await res.json()).toEqual({ error: 'invalid_transition' })

    const after = await payload.findByID({ collection: 'orders', id: orderId, overrideAccess: true })
    expect(after.status).toBe('done')
    expect(await transitionCount(orderId)).toBe(0)
  })

  it('manager는 취소하지 못한다 — 403이고 전이 기록도 남지 않는다', async () => {
    const payload = await localPayload()
    const orderId = await createOrder('paid')

    const res = await post({ orderId, to: 'cancelled' }, managerToken)
    expect(res.status).toBe(403)

    const after = await payload.findByID({ collection: 'orders', id: orderId, overrideAccess: true })
    expect(after.status).toBe('paid')
    expect(await transitionCount(orderId)).toBe(0)
  })

  it('super는 취소할 수 있다', async () => {
    const payload = await localPayload()
    const orderId = await createOrder('paid')

    const res = await post({ orderId, to: 'cancelled', reason: '고객 요청' }, superToken)
    expect(res.status).toBe(200)

    const after = await payload.findByID({ collection: 'orders', id: orderId, overrideAccess: true })
    expect(after.status).toBe('cancelled')
    expect(await transitionCount(orderId)).toBe(1)
  })

  it('알 수 없는 status 값은 400이고 주문에 눌러앉지 않는다', async () => {
    const payload = await localPayload()
    const orderId = await createOrder('paid')

    const res = await post({ orderId, to: 'refunded_by_hand' }, managerToken)
    expect(res.status).toBe(400)

    const after = await payload.findByID({ collection: 'orders', id: orderId, overrideAccess: true })
    expect(after.status).toBe('paid')
    expect(await transitionCount(orderId)).toBe(0)
  })
})
