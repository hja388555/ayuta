// 계약기간·광고시작일 저장 전용 경로(POST /api/admin/orders/schedule)의 권한 게이트와
// 이력 기록을 실제 서버·DB 앞에서 고정한다. 세션 게이트는 단위 테스트로 검증되지 않고,
// "안 바뀌었으면 기록하지 않는다"는 raw SQL 위에서만 성립한다.
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import type { Where } from 'payload'
import { api, login } from './helpers/server.js'
import { localPayload } from './helpers/localApi.js'

const RUN = Date.now()
const PW = 'Ayuta!Test-2026'
const uid = () => Math.random().toString(36).slice(2, 8)

const CUSTOMER = { email: `sch-cust+${RUN}@ayuta.test`, password: PW }
const MANAGER = { email: `sch-mgr+${RUN}@ayuta.test`, password: PW }

const base = { name: '홍길동', phone: '010-0000-0000', postalCode: '00000', address1: '서울시' }

const userIds: number[] = []
const orderIds: number[] = []

let customerToken: string | undefined
let managerToken: string | undefined
let managerId: number

const ENDPOINT = '/api/admin/orders/schedule'

const post = (body: unknown, token?: string) =>
  api(ENDPOINT, {
    method: 'POST',
    headers: token ? { Authorization: `JWT ${token}` } : {},
    body: JSON.stringify(body),
  })

const createOrder = async () => {
  const payload = await localPayload()
  const order = await payload.create({
    collection: 'orders',
    overrideAccess: true,
    data: {
      orderNumber: `AY-SCHR-${RUN}-${uid()}`,
      paymentId: `pay-schr-${RUN}-${uid()}`,
      status: 'paid',
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

const changes = async (orderId: number, field?: string) => {
  const payload = await localPayload()
  const where: Where = field
    ? { and: [{ order: { equals: orderId } }, { field: { equals: field } }] }
    : { order: { equals: orderId } }
  const { docs } = await payload.find({
    collection: 'order-schedule-changes',
    where,
    sort: '-at',
    limit: 100,
    overrideAccess: true,
  })
  return docs
}

beforeAll(async () => {
  const payload = await localPayload()
  for (const [creds, role] of [
    [CUSTOMER, 'customer'],
    [MANAGER, 'manager'],
  ] as const) {
    const created = await payload.create({
      collection: 'users',
      data: { ...creds, ...base, role },
      overrideAccess: true,
      // role을 실제로 심으려면 훅의 명시적 탈출구가 필요하다(auth 통합 테스트와 동일)
      context: { allowRoleAssignment: true },
    })
    const id = created.id as number
    userIds.push(id)
    if (creds === MANAGER) managerId = id

  }

  customerToken = (await login(CUSTOMER.email, CUSTOMER.password)).token
  managerToken = (await login(MANAGER.email, MANAGER.password)).token
  expect(customerToken && managerToken).toBeTruthy()
})

afterAll(async () => {
  const payload = await localPayload()
  const errors: string[] = []
  for (const id of orderIds) {
    // 이력이 주문을 참조하므로 먼저 지운다
    for (const doc of await changes(id)) {
      await payload
        .delete({ collection: 'order-schedule-changes', id: doc.id, overrideAccess: true })
        .catch((err) => errors.push(`order-schedule-changes id=${doc.id}: ${String(err)}`))
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

describe('POST /api/admin/orders/schedule', () => {
  it('비로그인은 401이고 이력도 남지 않는다', async () => {
    const orderId = await createOrder()
    const res = await post({ orderId, adStartDate: '2026-10-01' })
    expect(res.status).toBe(401)
    expect(await res.json()).toEqual({ error: 'unauthenticated' })
    expect(await changes(orderId)).toHaveLength(0)
  })


  it('로그인한 고객은 403이다', async () => {
    const orderId = await createOrder()
    const res = await post({ orderId, adStartDate: '2026-10-01' }, customerToken)
    expect(res.status).toBe(403)
    expect(await changes(orderId)).toHaveLength(0)
  })

  it('manager는 계약기간을 저장하고 바뀐 필드마다 이력이 남는다', async () => {
    const payload = await localPayload()
    const orderId = await createOrder()

    const res = await post({ orderId, adStartDate: '2026-10-01' }, managerToken)
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ ok: true, orderId, changed: ['adStartDate'] })
    expect(await changes(orderId)).toHaveLength(1)

    const order = await payload.findByID({ collection: 'orders', id: orderId, overrideAccess: true })
    // Asia/Seoul 자정으로 저장된다 — UTC 로는 전날 15:00
    expect(new Date(order.adStartDate!).toISOString()).toBe('2026-09-30T15:00:00.000Z')
  })

  it('같은 값을 다시 저장하면 이력이 늘지 않는다', async () => {
    const orderId = await createOrder()
    expect((await post({ orderId, adStartDate: '2026-10-01' }, managerToken)).status).toBe(200)
    const before = (await changes(orderId)).length

    const res = await post({ orderId, adStartDate: '2026-10-01' }, managerToken)
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ ok: true, orderId, changed: [] })
    expect(await changes(orderId)).toHaveLength(before)
  })

  it('종료일이 시작일보다 앞서면 400 invalid_schedule 이고 아무것도 남기지 않는다', async () => {
    const payload = await localPayload()
    const orderId = await createOrder()
    expect((await post({ orderId, contractStart: '2026-10-01' }, managerToken)).status).toBe(200)
    const before = (await changes(orderId)).length

    const res = await post({ orderId, contractEnd: '2026-01-01' }, managerToken)
    expect(res.status).toBe(400)
    expect(await res.json()).toEqual({ error: 'invalid_schedule' })
    expect(await changes(orderId)).toHaveLength(before)

    const order = await payload.findByID({ collection: 'orders', id: orderId, overrideAccess: true })
    expect(order.contractEnd).toBeFalsy()
  })

  it('null 로 되돌리면 값이 비워지고 그 사실도 이력에 남는다', async () => {
    const payload = await localPayload()
    const orderId = await createOrder()
    expect((await post({ orderId, adStartDate: '2026-10-01' }, managerToken)).status).toBe(200)

    const res = await post({ orderId, adStartDate: null }, managerToken)
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ ok: true, orderId, changed: ['adStartDate'] })

    const [latest] = await changes(orderId, 'adStartDate')
    expect(latest!.fromValue).toBe('2026-10-01')
    expect(latest!.toValue).toBeFalsy()

    const order = await payload.findByID({ collection: 'orders', id: orderId, overrideAccess: true })
    expect(order.adStartDate).toBeFalsy()
  })

  it('actor 는 클라이언트가 보낸 값이 아니라 세션 사용자다', async () => {
    const orderId = await createOrder()
    // 남의 id 를 실어 보내도 무시돼야 한다 — 그렇지 않으면 "누가"가 위조 가능해진다
    const res = await post({ orderId, contractStart: '2026-11-01', actorId: 999_999 }, managerToken)
    expect(res.status).toBe(200)

    const [latest] = await changes(orderId, 'contractStart')
    const actor = latest!.actor
    expect(typeof actor === 'object' && actor !== null ? actor.id : actor).toBe(managerId)
  })
})
