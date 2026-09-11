// 주문 CSV 내보내기(GET /api/admin/orders/export)의 게이트와 출력 형식을 실제 서버·DB 앞에서 고정한다.
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { api, login } from './helpers/server.js'
import { localPayload } from './helpers/localApi.js'

const RUN = Date.now()
const PW = 'Ayuta!Test-2026'
const CUSTOMER = { email: `exp-cust+${RUN}@ayuta.test`, password: PW }
const MANAGER = { email: `exp-mgr+${RUN}@ayuta.test`, password: PW }
const SUPER = { email: `exp-super+${RUN}@ayuta.test`, password: PW }

const base = { name: '홍길동', phone: '010-0000-0000', postalCode: '00000', address1: '서울시' }
const EVIL_NAME = '=HYPERLINK("http://evil.test")'
const PHONE = '010-9876-5432'

const userIds: number[] = []
let orderId: number
let orderNumber: string
const tokens: Record<'customer' | 'manager' | 'super', string | undefined> = {
  customer: undefined,
  manager: undefined,
  super: undefined,
}

const ENDPOINT = '/api/admin/orders/export'
const get = (path: string, token?: string) => api(path, { headers: token ? { Authorization: `JWT ${token}` } : {} })

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
      context: { allowRoleAssignment: true },
    })
    userIds.push(created.id as number)
  }

  orderNumber = `AY-EX-${RUN}`
  const order = await payload.create({
    collection: 'orders',
    overrideAccess: true,
    data: {
      orderNumber,
      paymentId: `pay-ex-${RUN}`,
      status: 'paid',
      currency: 'KRW',
      amount: 100_000,
      locale: 'ko',
      category: 1,
      items: [{ code: 'standard', label: '스탠다드', unitAmount: 100_000, quantity: 1 }],
      contractItems: [{ label: '등급', value: '스탠다드' }],
      orderer: {
        name: EVIL_NAME,
        phone: PHONE,
        email: 'evil@example.com',
        postcode: '12345',
        address1: '서울특별시 동대문구 답십리동 323',
      },
      signature: '홍길동',
      contractText: '테스트용 계약서 전문',
    },
  })
  orderId = order.id as number

  tokens.customer = (await login(CUSTOMER.email, CUSTOMER.password)).token
  tokens.manager = (await login(MANAGER.email, MANAGER.password)).token
  tokens.super = (await login(SUPER.email, SUPER.password)).token
  expect(tokens.customer && tokens.manager && tokens.super).toBeTruthy()
})

afterAll(async () => {
  const payload = await localPayload()
  await payload.delete({ collection: 'orders', id: orderId, overrideAccess: true }).catch(() => undefined)
  for (const id of userIds) await payload.delete({ collection: 'users', id, overrideAccess: true }).catch(() => undefined)
})

describe('주문 CSV 내보내기', () => {
  it('비로그인은 401, 고객은 403 이고 CSV 를 내주지 않는다', async () => {
    expect((await get(ENDPOINT)).status).toBe(401)
    const res = await get(`${ENDPOINT}?q=${orderNumber}`, tokens.customer)
    expect([403, 404]).toContain(res.status)
    expect(await res.text()).not.toContain(orderNumber)
  })

  for (const role of ['manager', 'super'] as const) {
    it(`${role} 는 BOM·헤더가 붙은 CSV 를 받는다`, async () => {
      const res = await get(`${ENDPOINT}?q=${encodeURIComponent(orderNumber)}`, tokens[role])
      expect(res.status).toBe(200)
      expect(res.headers.get('content-type')).toContain('text/csv')
      const bytes = new Uint8Array(await res.arrayBuffer())
      expect([...bytes.slice(0, 3)]).toEqual([0xef, 0xbb, 0xbf])
      const text = new TextDecoder('utf-8', { ignoreBOM: true }).decode(bytes).replace(/^\uFEFF/, '')
      const lines = text.trim().split('\r\n')
      expect(lines[0]).toBe('주문번호,주문일,고객,서비스,금액,상태')
      expect(lines).toHaveLength(2)
      expect(lines[1]).toContain(orderNumber)
    })
  }

  it('수식으로 시작하는 주문자명은 글자로 고정되고 연락처는 싣지 않는다', async () => {
    const res = await get(`${ENDPOINT}?q=${encodeURIComponent(orderNumber)}`, tokens.manager)
    const text = await res.text()
    expect(text).toContain(`"'=HYPERLINK(""http://evil.test"")"`)
    expect(text).not.toMatch(/(^|,)=HYPERLINK/m)
    expect(text).not.toContain(PHONE)
  })

  it('연락처로도 검색된다', async () => {
    const res = await get(`${ENDPOINT}?q=${encodeURIComponent(PHONE)}`, tokens.manager)
    expect(await res.text()).toContain(orderNumber)
  })
})
