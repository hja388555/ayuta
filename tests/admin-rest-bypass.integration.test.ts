// Payload 가 자동으로 여는 REST(/api/<slug>)·GraphQL 이 /manage 의 2단계 인증 게이트를
// 옆으로 돌아가지 못하는지 고정한다. 컬렉션 access 가 role 만 보던 시절에는 OTP 를 거치지
// 않은 관리자 세션이 이 경로로 고객 개인정보·계약서 전문·연락메모를 그대로 읽었다.
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { api, login } from './helpers/server.js'
import { localPayload } from './helpers/localApi.js'

const RUN = Date.now()
const PW = 'Ayuta!Test-2026'
const VERIFIED = { email: `rest-mgr+${RUN}@ayuta.test`, password: PW }
const UNVERIFIED = { email: `rest-unverified+${RUN}@ayuta.test`, password: PW }

const base = { name: '홍길동', phone: '010-0000-0000', postalCode: '00000', address1: '서울시' }

const userIds: number[] = []
const otpIds: number[] = []
let orderId: number
let noteId: number
let orderNumber: string
let verifiedToken: string | undefined
let unverifiedToken: string | undefined

const CONTRACT = `REST우회테스트계약서-${RUN}`
const NOTE = `REST우회테스트메모-${RUN}`

const auth = (token?: string): Record<string, string> => (token ? { Authorization: `JWT ${token}` } : {})
const get = (path: string, token?: string) => api(path, { headers: auth(token) })

beforeAll(async () => {
  const payload = await localPayload()
  for (const [creds, verified] of [
    [VERIFIED, true],
    [UNVERIFIED, false],
  ] as const) {
    const created = await payload.create({
      collection: 'users',
      data: { ...creds, ...base, role: 'manager' },
      overrideAccess: true,
      context: { allowRoleAssignment: true },
    })
    const id = created.id as number
    userIds.push(id)
    if (!verified) continue
    const otp = await payload.create({
      collection: 'admin-otps',
      data: {
        user: id,
        hash: 'x'.repeat(64),
        salt: 'y'.repeat(32),
        expiresAt: new Date(Date.now() + 10 * 60 * 1000).toISOString(),
        consumedAt: new Date().toISOString(),
        attempts: 1,
      },
      overrideAccess: true,
    })
    otpIds.push(otp.id as number)
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

  verifiedToken = (await login(VERIFIED.email, VERIFIED.password)).token
  unverifiedToken = (await login(UNVERIFIED.email, UNVERIFIED.password)).token
  expect(verifiedToken && unverifiedToken).toBeTruthy()
})

afterAll(async () => {
  const payload = await localPayload()
  const errors: string[] = []
  const drop = async (collection: 'order-notes' | 'orders' | 'admin-otps' | 'users', id: number) => {
    try {
      await payload.delete({ collection, id, overrideAccess: true })
    } catch (err) {
      errors.push(`${collection} id=${id}: ${err instanceof Error ? err.message : String(err)}`)
    }
  }
  await drop('order-notes', noteId)
  await drop('orders', orderId)
  for (const id of otpIds) await drop('admin-otps', id)
  for (const id of userIds) await drop('users', id)
  if (errors.length > 0) throw new Error(`테스트 데이터 정리 실패:\n${errors.join('\n')}`)
})

describe('2단계 인증을 안 끝낸 관리자 — Payload REST', () => {
  for (const path of ['/api/orders', '/api/order-notes', '/api/order-schedule-changes', '/api/order-transitions']) {
    it(`GET ${path} 는 403 이고 데이터가 나가지 않는다`, async () => {
      const res = await get(path, unverifiedToken)
      expect(res.status).toBe(403)
      const text = await res.text()
      expect(text).not.toContain(orderNumber)
      expect(text).not.toContain(NOTE)
    })
  }

  it('GET /api/orders/:id 는 403 이고 계약서 전문이 나가지 않는다', async () => {
    const res = await get(`/api/orders/${orderId}`, unverifiedToken)
    expect(res.status).toBe(403)
    expect(await res.text()).not.toContain(CONTRACT)
  })

  it('PATCH /api/orders/:id 는 403 이고 값이 바뀌지 않는다', async () => {
    const res = await api(`/api/orders/${orderId}`, {
      method: 'PATCH',
      headers: auth(unverifiedToken),
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
      headers: auth(unverifiedToken),
      body: JSON.stringify({ order: orderId, body: '우회 메모' }),
    })
    expect(res.status).toBe(403)
  })
})

describe('2단계 인증을 안 끝낸 관리자 — GraphQL', () => {
  it('Orders · OrderNotes 조회에 데이터가 실리지 않는다', async () => {
    const res = await api('/api/graphql', {
      method: 'POST',
      headers: auth(unverifiedToken),
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

describe('2단계 인증을 끝낸 관리자는 그대로 읽는다 (회귀 방지)', () => {
  it('GET /api/orders/:id 는 200 이다', async () => {
    const res = await get(`/api/orders/${orderId}`, verifiedToken)
    expect(res.status).toBe(200)
    expect((await res.json()).orderNumber).toBe(orderNumber)
  })
})
