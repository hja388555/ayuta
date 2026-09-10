// Payload 가 자동으로 여는 REST(/api/<slug>)·GraphQL 이 /manage 게이트를 옆으로 돌아가지
// 못하는지 고정한다. 주문·연락메모에는 고객 개인정보와 계약서 전문이 담긴다 — 관리자가 아닌
// 세션(로그인한 고객)이 이 경로로 읽거나 고치면 /manage 를 404 로 감춘 의미가 없어진다.
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { api, login } from './helpers/server.js'
import { localPayload } from './helpers/localApi.js'

const RUN = Date.now()
const PW = 'Ayuta!Test-2026'
const MANAGER = { email: `rest-mgr+${RUN}@ayuta.test`, password: PW }
const CUSTOMER = { email: `rest-cust+${RUN}@ayuta.test`, password: PW }

const base = { name: '홍길동', phone: '010-0000-0000', postalCode: '00000', address1: '서울시' }

const userIds: number[] = []
let orderId: number
let noteId: number
let orderNumber: string
let managerToken: string | undefined
let customerToken: string | undefined

const CONTRACT = `REST우회테스트계약서-${RUN}`
const NOTE = `REST우회테스트메모-${RUN}`

const auth = (token?: string): Record<string, string> => (token ? { Authorization: `JWT ${token}` } : {})
const get = (path: string, token?: string) => api(path, { headers: auth(token) })

beforeAll(async () => {
  const payload = await localPayload()
  for (const [creds, role] of [
    [MANAGER, 'manager'],
    [CUSTOMER, 'customer'],
  ] as const) {
    const created = await payload.create({
      collection: 'users',
      data: { ...creds, ...base, role },
      overrideAccess: true,
      context: { allowRoleAssignment: true },
    })
    userIds.push(created.id as number)
  }

  orderNumber = `AY-RB-${RUN}`
  const order = await payload.create({
    collection: 'orders',
    overrideAccess: true,
    data: {
      orderNumber,
      paymentId: `pay-rb-${RUN}`,
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
      contractText: CONTRACT,
    },
  })
  orderId = order.id as number
  const note = await payload.create({
    collection: 'order-notes',
    data: { order: orderId, body: NOTE },
    overrideAccess: true,
  })
  noteId = note.id as number

  managerToken = (await login(MANAGER.email, MANAGER.password)).token
  customerToken = (await login(CUSTOMER.email, CUSTOMER.password)).token
  expect(managerToken && customerToken).toBeTruthy()
})

afterAll(async () => {
  const payload = await localPayload()
  const errors: string[] = []
  const drop = async (collection: 'order-notes' | 'orders' | 'users', id: number) => {
    try {
      await payload.delete({ collection, id, overrideAccess: true })
    } catch (err) {
      errors.push(`${collection} id=${id}: ${err instanceof Error ? err.message : String(err)}`)
    }
  }
  await drop('order-notes', noteId)
  await drop('orders', orderId)
  for (const id of userIds) await drop('users', id)
  if (errors.length > 0) throw new Error(`테스트 데이터 정리 실패:\n${errors.join('\n')}`)
})

describe('로그인한 고객 — Payload REST 로 주문 데이터에 닿지 못한다', () => {
  for (const path of ['/api/orders', '/api/order-notes', '/api/order-schedule-changes', '/api/order-transitions']) {
    it(`GET ${path} 는 403 이고 데이터가 나가지 않는다`, async () => {
      const res = await get(path, customerToken)
      expect(res.status).toBe(403)
      const text = await res.text()
      expect(text).not.toContain(orderNumber)
      expect(text).not.toContain(NOTE)
    })
  }

  it('비로그인도 GET /api/orders 는 403 이다', async () => {
    expect((await get('/api/orders')).status).toBe(403)
  })

  it('GET /api/orders/:id 는 403 이고 계약서 전문이 나가지 않는다', async () => {
    const res = await get(`/api/orders/${orderId}`, customerToken)
    expect(res.status).toBe(403)
    expect(await res.text()).not.toContain(CONTRACT)
  })

  it('PATCH /api/orders/:id 는 403 이고 값이 바뀌지 않는다', async () => {
    const res = await api(`/api/orders/${orderId}`, {
      method: 'PATCH',
      headers: auth(customerToken),
      body: JSON.stringify({ failReason: '우회 변경', locale: 'ja' }),
    })
    expect(res.status).toBe(403)
    const payload = await localPayload()
    const doc = await payload.findByID({ collection: 'orders', id: orderId, overrideAccess: true })
    expect(doc.failReason ?? null).toBe(null)
    expect(doc.locale).toBe('ko')
  })

  it('POST /api/order-notes 는 403 이다', async () => {
    const res = await api('/api/order-notes', {
      method: 'POST',
      headers: auth(customerToken),
      body: JSON.stringify({ order: orderId, body: '우회 메모' }),
    })
    expect(res.status).toBe(403)
  })
})

describe('로그인한 고객 — GraphQL', () => {
  it('Orders · OrderNotes 조회에 데이터가 실리지 않는다', async () => {
    const res = await api('/api/graphql', {
      method: 'POST',
      headers: auth(customerToken),
      body: JSON.stringify({
        query: '{ Orders { docs { orderNumber contractText } } OrderNotes { docs { body } } }',
      }),
    })
    const text = await res.text()
    expect(text).not.toContain(orderNumber)
    expect(text).not.toContain(CONTRACT)
    expect(text).not.toContain(NOTE)
  })
})

describe('관리자는 그대로 읽는다 (회귀 방지)', () => {
  it('GET /api/orders/:id 는 200 이다', async () => {
    const res = await get(`/api/orders/${orderId}`, managerToken)
    expect(res.status).toBe(200)
    expect((await res.json()).orderNumber).toBe(orderNumber)
  })
})
