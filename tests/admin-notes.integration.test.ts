// 연락메모 작성 경로(POST /api/admin/orders/notes)와 관리자 주문 화면의 게이트를
// 실제 서버·DB 앞에서 고정한다. 단위 테스트로는 세션·2단계 인증 게이트가 검증되지 않는다.
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { api, login } from './helpers/server.js'
import { localPayload } from './helpers/localApi.js'

const RUN = Date.now()
const PW = 'Ayuta!Test-2026'
const CUSTOMER = { email: `note-cust+${RUN}@ayuta.test`, password: PW }
const MANAGER = { email: `note-mgr+${RUN}@ayuta.test`, password: PW }
// 2단계 인증을 끝내지 않은 관리자. 이 계정에는 소비된 OTP 행을 심지 않는다
const UNVERIFIED = { email: `note-unverified+${RUN}@ayuta.test`, password: PW }

const base = { name: '홍길동', phone: '010-0000-0000', postalCode: '00000', address1: '서울시' }

const userIds: number[] = []
const otpIds: number[] = []
const noteIds: number[] = []
let orderId: number
let orderNumber: string

let customerToken: string | undefined
let managerToken: string | undefined
let unverifiedToken: string | undefined

const ENDPOINT = '/api/admin/orders/notes'

const post = (body: unknown, token?: string) =>
  api(ENDPOINT, {
    method: 'POST',
    headers: token ? { Authorization: `JWT ${token}` } : {},
    body: JSON.stringify(body),
  })

const noteCount = async () => {
  const payload = await localPayload()
  const { docs } = await payload.find({
    collection: 'order-notes',
    where: { order: { equals: orderId } },
    overrideAccess: true,
  })
  return docs.length
}

beforeAll(async () => {
  const payload = await localPayload()
  for (const [creds, role, verified] of [
    [CUSTOMER, 'customer', false],
    [MANAGER, 'manager', true],
    [UNVERIFIED, 'manager', false],
  ] as const) {
    const created = await payload.create({
      collection: 'users',
      data: { ...creds, ...base, role },
      overrideAccess: true,
      context: { allowRoleAssignment: true },
    })
    const id = created.id as number
    userIds.push(id)
    if (!verified) continue
    // requireAdminVerified()를 만족시키는 "이미 소비된 OTP" 행을 심는다
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

  orderNumber = `AY-NT-${RUN}`
  const order = await payload.create({
    collection: 'orders',
    overrideAccess: true,
    data: {
      orderNumber,
      paymentId: `pay-nt-${RUN}`,
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
  orderId = order.id as number

  customerToken = (await login(CUSTOMER.email, CUSTOMER.password)).token
  managerToken = (await login(MANAGER.email, MANAGER.password)).token
  unverifiedToken = (await login(UNVERIFIED.email, UNVERIFIED.password)).token
  expect(customerToken && managerToken && unverifiedToken).toBeTruthy()
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
  // 메모가 주문을 참조하므로 먼저 지운다
  const { docs } = await payload.find({
    collection: 'order-notes',
    where: { order: { equals: orderId } },
    overrideAccess: true,
  })
  for (const doc of docs) await drop('order-notes', doc.id as number)
  await drop('orders', orderId)
  for (const id of otpIds) await drop('admin-otps', id)
  for (const id of userIds) await drop('users', id)
  if (errors.length > 0) throw new Error(`테스트 데이터 정리 실패:\n${errors.join('\n')}`)
})

describe('POST /api/admin/orders/notes', () => {
  it('비로그인은 401이다', async () => {
    const res = await post({ orderId, body: '남의 주문에 메모' })
    expect(res.status).toBe(401)
    expect(await noteCount()).toBe(0)
  })

  it('로그인한 고객은 403이다', async () => {
    const res = await post({ orderId, body: '고객이 남기는 메모' }, customerToken)
    expect(res.status).toBe(403)
    expect(await noteCount()).toBe(0)
  })

  it('2단계 인증을 끝내지 않은 관리자는 403 otp_required 다', async () => {
    // Payload REST(/api/order-notes)는 이 게이트를 모른다 — 그래서 전용 경로를 둔다.
    // pin: notes/route.ts 의 requireAdminVerified() + OtpRequiredError 분기
    const res = await post({ orderId, body: '인증 전 메모' }, unverifiedToken)
    expect(res.status).toBe(403)
    expect(await res.json()).toEqual({ error: 'otp_required' })
    expect(await noteCount()).toBe(0)
  })

  it('빈 메모는 400 invalid_input 이다', async () => {
    const res = await post({ orderId, body: '   ' }, managerToken)
    expect(res.status).toBe(400)
    expect(await res.json()).toEqual({ error: 'invalid_input' })
    expect(await noteCount()).toBe(0)
  })

  it('2단계 인증을 끝낸 관리자는 메모를 남기고 author 가 세션 사용자로 박힌다', async () => {
    const res = await post({ orderId, body: '고객에게 시작일 안내함' }, managerToken)
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.ok).toBe(true)
    noteIds.push(body.noteId as number)

    const payload = await localPayload()
    const note = await payload.findByID({ collection: 'order-notes', id: body.noteId, overrideAccess: true })
    expect(note.body).toBe('고객에게 시작일 안내함')
    // 클라이언트가 author 를 보내지 않아도 서버가 채운다 — 익명 기록이 남으면 근거가 못 된다
    const authorId = typeof note.author === 'number' ? note.author : (note.author as { id: number } | null)?.id
    expect(authorId).toBe(userIds[1])
  })

  it('없는 주문 id 는 400 note_failed 다 — 존재 여부를 구분해 알려주지 않는다', async () => {
    const res = await post({ orderId: 2_000_000_000, body: '메모' }, managerToken)
    expect(res.status).toBe(400)
    expect(await res.json()).toEqual({ error: 'note_failed' })
  })
})

describe('관리자 주문 화면 게이트', () => {
  const page = (path: string, token?: string) =>
    api(path, { headers: token ? { Authorization: `JWT ${token}` } : {} })

  it('비로그인은 목록·상세 모두 404다 — 화면이 있다는 사실 자체를 알리지 않는다', async () => {
    expect((await page('/manage/orders')).status).toBe(404)
    expect((await page(`/manage/orders/${orderId}`)).status).toBe(404)
  })

  it('로그인한 고객도 404다', async () => {
    expect((await page('/manage/orders', customerToken)).status).toBe(404)
    expect((await page(`/manage/orders/${orderId}`, customerToken)).status).toBe(404)
  })

  it('2단계 인증을 끝낸 관리자에게는 주문번호와 고객 연락처가 보인다', async () => {
    const res = await page(`/manage/orders/${orderId}`, managerToken)
    expect(res.status).toBe(200)
    const html = await res.text()
    expect(html).toContain(orderNumber)
    expect(html).toContain('010-1234-5678')
  })

  it('숫자가 아닌 주문 id 는 404다', async () => {
    expect((await page('/manage/orders/abc', managerToken)).status).toBe(404)
  })
})
