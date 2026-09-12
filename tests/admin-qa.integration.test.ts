// 관리자 QA 지적(2026-09-12)으로 걸어 둔 서버 쪽 방어를 실제 서버·DB 앞에서 고정한다:
// 단가 상한 · 견적 발행 상한 · 광고 진행일 계약기간 검사 · 연락처 하이픈 무관 검색 · /manage 캐시 금지.
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { localPayload } from './helpers/localApi.js'
import { BASE, api, login } from './helpers/server.js'

const RUN = Date.now()
const PW = 'Ayuta!Test-2026'
const base = { name: '홍길동', phone: '010-0000-0000', postalCode: '00000', address1: '서울시' }
const uid = () => Math.random().toString(36).slice(2, 8)
// 다른 테스트 데이터와 겹치지 않는 연락처 숫자
const PHONE_DIGITS = `019${String(RUN).slice(-8)}`
const PHONE_HYPHEN = `${PHONE_DIGITS.slice(0, 3)}-${PHONE_DIGITS.slice(3, 7)}-${PHONE_DIGITS.slice(7)}`

const userIds: number[] = []
const orderIds: number[] = []
const tokens: Record<string, string | undefined> = {}
let entryId: number
let inquiryId: number

const auth = (who?: string): Record<string, string> => (who && tokens[who] ? { Authorization: `JWT ${tokens[who]}` } : {})
const post = (path: string, body: unknown, who?: string) => api(path, { method: 'POST', headers: auth(who), body: JSON.stringify(body) })

const createOrder = async (phone: string) => {
  const payload = await localPayload()
  const order = await payload.create({
    collection: 'orders',
    overrideAccess: true,
    data: {
      orderNumber: `AY-QA-${RUN}-${uid()}`,
      paymentId: `pay-qa-${RUN}-${uid()}`,
      status: 'paid',
      currency: 'KRW',
      amount: 100_000,
      locale: 'ko',
      category: 1,
      items: [{ code: 'standard', label: '스탠다드', unitAmount: 100_000, quantity: 1 }],
      contractItems: [{ label: '등급', value: '스탠다드' }],
      orderer: { name: 'QA고객', phone, email: 'qa@example.com', postcode: '12345', address1: '서울특별시' },
      signature: 'QA고객',
      contractText: '테스트용 계약서 전문',
    },
  })
  orderIds.push(order.id as number)
  return order
}

beforeAll(async () => {
  const payload = await localPayload()
  for (const role of ['super', 'manager'] as const) {
    const email = `qa-${role}+${RUN}@ayuta.test`
    const u = await payload.create({ collection: 'users', data: { email, password: PW, ...base, role }, overrideAccess: true, context: { allowRoleAssignment: true } })
    userIds.push(u.id as number)
    tokens[role] = (await login(email, PW)).token
  }
  const entry = await payload.create({
    collection: 'price-entries',
    overrideAccess: true,
    data: { key: `qa-limit-${RUN}`, labelKo: '상한검증', labelJa: '上限検証', category: 4, priceKrw: 1000, priceJpy: 100, active: true },
  })
  entryId = entry.id as number

  const fd = new FormData()
  for (const [k, v] of Object.entries({ type: 'other', body: `QA 견적-${RUN}`, name: 'QA', phone: '010-5555-0000', email: `qa+${RUN}@example.com`, locale: 'ko', consent: 'on', country: 'kr' })) fd.set(k, v)
  inquiryId = (await (await fetch(`${BASE}/api/inquiry`, { method: 'POST', body: fd })).json()).inquiryId
})

afterAll(async () => {
  const payload = await localPayload()
  const errors: string[] = []
  const attempt = async (label: string, fn: () => Promise<unknown>) => fn().catch((err) => errors.push(`${label}: ${String(err)}`))
  await attempt('price-entries', () => payload.delete({ collection: 'price-entries', id: entryId, overrideAccess: true }))
  if (inquiryId) {
    await attempt('quotes_lines', () => payload.db.pool.query('DELETE FROM quotes_lines WHERE _parent_id IN (SELECT id FROM quotes WHERE inquiry_id = $1)', [inquiryId]))
    await attempt('quotes', () => payload.db.pool.query('DELETE FROM quotes WHERE inquiry_id = $1', [inquiryId]))
    await attempt('inquiries', () => payload.db.pool.query('DELETE FROM inquiries WHERE id = $1', [inquiryId]))
  }
  for (const id of orderIds) {
    await attempt(`schedule-changes ${id}`, () => payload.db.pool.query('DELETE FROM order_schedule_changes WHERE order_id = $1', [id]))
    await attempt(`orders ${id}`, () => payload.delete({ collection: 'orders', id, overrideAccess: true }))
  }
  await attempt('login logs', () => payload.db.pool.query('DELETE FROM admin_login_logs WHERE user_id = ANY($1::int[])', [userIds]))
  for (const id of userIds) await attempt(`users ${id}`, () => payload.delete({ collection: 'users', id, overrideAccess: true }))
  if (errors.length > 0) throw new Error(`테스트 데이터 정리 실패:\n${errors.join('\n')}`)
})

describe('단가 상한', () => {
  it('10억을 넘는 단가는 400 price_too_large 이고 저장되지 않는다', async () => {
    const payload = await localPayload()
    for (const big of [1_000_000_001, 2_147_483_648, 99_999_999_999_999_999]) {
      const res = await post('/api/admin/prices', { id: entryId, priceKrw: big, priceJpy: 100, active: true }, 'super')
      expect(res.status).toBe(400)
      expect(await res.json()).toEqual({ error: 'price_too_large' })
    }
    expect((await payload.findByID({ collection: 'price-entries', id: entryId, overrideAccess: true })).priceKrw).toBe(1000)
  })

  it('딱 10억은 저장된다', async () => {
    const res = await post('/api/admin/prices', { id: entryId, priceKrw: 1_000_000_000, priceJpy: 100, active: true }, 'super')
    expect(res.status).toBe(200)
  })
})

describe('견적 발행 상한', () => {
  it('999 × 100억 · 단가 10억 초과 · 합계 100억 초과는 400 quote_too_large 이고 발행되지 않는다', async () => {
    for (const lines of [
      [{ label: 'x', quantity: 999, unitAmount: 10_000_000_000 }],
      [{ label: 'x', quantity: 1, unitAmount: 1_000_000_001 }],
      [{ label: 'x', quantity: 11, unitAmount: 1_000_000_000 }],
    ]) {
      const res = await post('/api/admin/quotes', { inquiryId, lines }, 'manager')
      expect(res.status).toBe(400)
      const body = await res.json()
      expect(['quote_too_large', 'invalid_quote_lines']).toContain(body.error)
    }
    const payload = await localPayload()
    expect((await payload.count({ collection: 'quotes', where: { inquiry: { equals: inquiryId } }, overrideAccess: true })).totalDocs).toBe(0)
  })
})

describe('광고 진행일은 계약기간 안', () => {
  it('계약기간 밖 진행일은 400 ad_date_outside_period, 경계일은 저장된다', async () => {
    const order = await createOrder('010-0000-0000')
    const orderId = order.id as number
    const before = await post('/api/admin/orders/schedule', { orderId, contractStart: '2026-10-01', contractEnd: '2026-10-31', adStartDate: '2026-09-30' }, 'manager')
    expect(before.status).toBe(400)
    expect(await before.json()).toEqual({ error: 'ad_date_outside_period' })
    const after = await post('/api/admin/orders/schedule', { orderId, contractStart: '2026-10-01', contractEnd: '2026-10-31', adStartDate: '2026-11-01' }, 'manager')
    expect(after.status).toBe(400)
    const edge = await post('/api/admin/orders/schedule', { orderId, contractStart: '2026-10-01', contractEnd: '2026-10-31', adStartDate: '2026-10-31' }, 'manager')
    expect(edge.status).toBe(200)
  })
})

describe('연락처 검색은 하이픈과 무관하다', () => {
  it('010-xxxx-xxxx 와 숫자만 검색이 같은 주문을 찾는다', async () => {
    const a = await createOrder(PHONE_HYPHEN)
    const b = await createOrder(PHONE_DIGITS)
    const csv = async (q: string) => {
      const res = await api(`/api/admin/orders/export?q=${encodeURIComponent(q)}`, { headers: auth('manager') })
      expect(res.status).toBe(200)
      return (await res.text()).trim().split('\r\n').slice(1)
    }
    const withHyphen = await csv(PHONE_HYPHEN)
    const digitsOnly = await csv(PHONE_DIGITS)
    const spaced = await csv(PHONE_HYPHEN.replace(/-/g, ' '))
    expect(withHyphen).toHaveLength(2)
    expect(digitsOnly).toHaveLength(2)
    expect(spaced).toHaveLength(2)
    for (const rows of [withHyphen, digitsOnly]) {
      expect(rows.join('\n')).toContain(a.orderNumber)
      expect(rows.join('\n')).toContain(b.orderNumber)
    }
  })
})

describe('/manage 캐시 금지', () => {
  // 운영(next start)은 동적 페이지에 private, no-cache, no-store 를 싣는다. next dev 는 모든 페이지 응답을
  // 'no-cache, must-revalidate' 로 덮어써서(next/dist/server/base-server.js) no-store 를 걸 수 없다 —
  // dev 에서는 캐시를 재검증 없이 쓰지 못한다는 것만 확인하고, 뒤로가기 복원은 AdminBfcacheGuard 가 막는다
  const dev = process.env.TEST_EXPECT_PROD_HEADERS !== '1'
  it('관리자 화면 응답은 캐시에 그대로 남지 않는다(로그인 여부와 무관)', async () => {
    for (const path of ['/manage', '/manage/orders']) {
      const authed = await fetch(`${BASE}${path}`, { headers: auth('manager') })
      expect(authed.status).toBe(200)
      const anon = await fetch(`${BASE}${path}`)
      for (const res of [authed, anon]) {
        const cc = res.headers.get('cache-control') ?? ''
        if (dev) expect(cc).toMatch(/no-store|no-cache/)
        else expect(cc).toContain('no-store')
        expect(cc).not.toMatch(/public|s-maxage/)
      }
    }
  })
})
