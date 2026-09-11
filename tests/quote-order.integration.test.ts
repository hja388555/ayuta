// 5번 견적 링크 결제(POST /api/quote/order)를 실제 서버·DB 앞에서 고정한다. 금액이 저장된 견적에서만
// 오는지, 토큰 상태(없음·만료·회수)가 막히는지, 같은 견적을 다시 보내도 주문이 하나인지, 서명 조작이
// 막히는지를 본다.
//
// 5번 계약서 원문은 아직 시드되지 않았다(scripts/seed-contracts.ts). 없으면 이 파일이 테스트용 템플릿을
// 잠시 만들고 끝나면 지운다 — 이미 있으면 건드리지 않고 그대로 쓴다.
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { BASE, api, login } from './helpers/server.js'
import { localPayload } from './helpers/localApi.js'

const RUN = Date.now()
const PW = 'Ayuta!Test-2026'
const lines = [
  { label: '현수막 제작', quantity: 2, unitAmount: 150_000 },
  { label: '설치', quantity: 1, unitAmount: 50_000 },
]
const orderer = {
  name: `견적주문자${RUN}`,
  phone: '010-5555-0000',
  email: `quote-order+${RUN}@example.com`,
  postalCode: '12345',
  address1: '서울특별시 동대문구 답십리동 323',
}
const consents = { terms: true, privacy: true, contract: true }

const TEST_TEMPLATE = [
  '테스트 견적 계약서',
  '{{items}}',
  '계약금액: {{amount}}',
  '계약일: {{contractDate}}',
  '갑: {{buyerName}} / {{buyerAddress}} / {{buyerEmail}} / {{buyerPhone}}',
  '을: {{companyName}}',
  '전자서명: {{signature}}',
].join('\n')

let managerId: number
let managerToken: string | undefined
let inquiryId: number
let createdTemplateId: number | null = null
const quoteIds: number[] = []

type Issued = { quoteId: number; quoteNumber: string; path: string }
const issue = async (): Promise<Issued & { token: string }> => {
  const res = await api('/api/admin/quotes', { method: 'POST', headers: { Authorization: `JWT ${managerToken}` }, body: JSON.stringify({ inquiryId, lines }) })
  expect(res.status).toBe(200)
  const body = (await res.json()) as Issued
  quoteIds.push(body.quoteId)
  return { ...body, token: body.path.split('/').pop() as string }
}
const order = (body: Record<string, unknown>) => api('/api/quote/order', { method: 'POST', body: JSON.stringify(body) })
const valid = (token: string) => ({ token, locale: 'ko', consents, orderer: { ...orderer }, signature: orderer.name })

let first: Issued & { token: string }

beforeAll(async () => {
  const payload = await localPayload()
  const email = `quote-order-manager+${RUN}@ayuta.test`
  const u = await payload.create({
    collection: 'users',
    data: { email, password: PW, name: '매니저', phone: '010-0000-0000', postalCode: '00000', address1: '서울시', role: 'manager' },
    overrideAccess: true,
    context: { allowRoleAssignment: true },
  })
  managerId = u.id as number
  managerToken = (await login(email, PW)).token

  const { docs } = await payload.find({ collection: 'contract-templates', where: { and: [{ category: { equals: 5 } }, { locale: { equals: 'ko' } }] }, limit: 1, overrideAccess: true })
  if (!docs[0]) {
    const tpl = await payload.create({
      collection: 'contract-templates',
      data: { category: 5, locale: 'ko', title: `테스트 5번 계약서 ${RUN}`, body: TEST_TEMPLATE, consents: Object.keys(consents).map((key) => ({ key, label: key, required: true })), active: true },
      overrideAccess: true,
    })
    createdTemplateId = tpl.id as number
  }

  const fd = new FormData()
  for (const [k, v] of Object.entries({ type: 'other', body: `견적결제테스트-${RUN}`, name: orderer.name, phone: orderer.phone, email: orderer.email, locale: 'ko', consent: 'on', country: 'kr' })) fd.set(k, v)
  const res = await fetch(`${BASE}/api/inquiry`, { method: 'POST', body: fd })
  inquiryId = (await res.json()).inquiryId

  first = await issue()
})

afterAll(async () => {
  const payload = await localPayload()
  const pool = payload.db.pool
  const keys = quoteIds.map((id) => `quote-${id}`)
  const { docs: orders } = await payload.find({ collection: 'orders', where: { idempotencyKey: { in: keys } }, limit: 100, overrideAccess: true })
  for (const o of orders) await payload.delete({ collection: 'orders', id: o.id, overrideAccess: true }).catch(() => {})
  await pool.query('DELETE FROM quotes_lines WHERE _parent_id IN (SELECT id FROM quotes WHERE inquiry_id = $1)', [inquiryId]).catch(() => {})
  await pool.query('DELETE FROM quotes WHERE inquiry_id = $1', [inquiryId]).catch(() => {})
  await pool.query('DELETE FROM inquiries WHERE id = $1', [inquiryId]).catch(() => {})
  if (createdTemplateId) {
    await pool.query("DELETE FROM legal_revisions WHERE target = 'contract-templates' AND doc_id = $1", [createdTemplateId]).catch(() => {})
    await payload.delete({ collection: 'contract-templates', id: createdTemplateId, overrideAccess: true }).catch(() => {})
  }
  await payload.delete({ collection: 'users', id: managerId, overrideAccess: true }).catch(() => {})
})

describe('견적 화면', () => {
  it('유효한 견적은 결제 폼(주문자·계약서 동의·결제 버튼)을 그린다', async () => {
    const res = await api(first.path)
    expect(res.status).toBe(200)
    const html = await res.text()
    expect(html).toContain(first.quoteNumber)
    expect(html).toContain('co-name')
    expect(html).toContain('350,000')
    // 예전 목업처럼 문의 이름이 동의 전에 서명칸에 미리 찍히지 않는다
    expect(html).not.toContain(`>${orderer.name}</span>`)
  })
})

describe('POST /api/quote/order', () => {
  it('서명이 주문자명과 다르면 거부하고 주문을 만들지 않는다', async () => {
    const res = await order({ ...valid(first.token), signature: '다른사람' })
    expect(res.status).toBe(400)
    expect((await res.json()).reason).toBe('signature_mismatch')
    const payload = await localPayload()
    expect((await payload.count({ collection: 'orders', where: { idempotencyKey: { equals: `quote-${first.quoteId}` } }, overrideAccess: true })).totalDocs).toBe(0)
  })

  it('필수 동의가 빠지면 거부한다', async () => {
    const res = await order({ ...valid(first.token), consents: { terms: true } })
    expect(res.status).toBe(400)
    expect((await res.json()).reason).toBe('consent_required')
  })

  it('없는 토큰·모양이 틀린 토큰은 invalid_quote 다', async () => {
    for (const token of ['AAAAAAAAAAAAAAAAAAAAAA', 'not-a-token']) {
      const res = await order(valid(token))
      expect(res.status).toBe(400)
      expect((await res.json()).reason).toBe('invalid_quote')
    }
  })

  it('유효한 견적이면 pending 주문을 만들고, 클라이언트가 보낸 금액·라인은 무시한다', async () => {
    const res = await order({ ...valid(first.token), amount: 1, total: 1, currency: 'JPY', lines: [{ label: '조작', quantity: 1, unitAmount: 1 }], idempotencyKey: 'client-key' })
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body).toMatchObject({ ok: true, amount: 350_000, currency: 'KRW' })
    const cookie = (res.headers.get('set-cookie') ?? '').split(';')[0]
    expect(cookie).toMatch(/^ayuta_guest_proof=/)

    const payload = await localPayload()
    const { docs } = await payload.find({ collection: 'orders', where: { orderNumber: { equals: body.orderNumber } }, limit: 1, overrideAccess: true })
    const o = docs[0]
    expect(o).toBeTruthy()
    if (!o) return
    expect(o.status).toBe('pending')
    expect(o.amount).toBe(350_000)
    expect(o.currency).toBe('KRW')
    expect(o.category).toBe(5)
    expect(o.idempotencyKey).toBe(`quote-${first.quoteId}`)
    expect(o.items).toEqual([
      expect.objectContaining({ label: '현수막 제작', quantity: 2, unitAmount: 150_000 }),
      expect.objectContaining({ label: '설치', quantity: 1, unitAmount: 50_000 }),
    ])
    expect(o.signature).toBe(orderer.name)
    expect(o.orderer?.email).toBe(orderer.email)
    const text = o.contractText as string
    expect(text).toContain(first.quoteNumber)
    expect(text).not.toContain('{{')
    if (createdTemplateId) {
      expect(text).toContain('계약금액: ₩350,000')
      expect(text).toContain(`전자서명: ${orderer.name}`)
    }

    // 비회원도 완료 화면에서 방금 만든 주문을 연다(서명된 쿠키)
    const complete = await api(`/ko/order/complete?order=${encodeURIComponent(body.orderNumber)}`, { headers: { cookie } })
    expect(await complete.text()).toContain(body.orderNumber)
  })

  it('같은 주문자가 다시 보내면 같은 주문을 돌려주고 새로 만들지 않는다', async () => {
    const [a, b] = await Promise.all([order(valid(first.token)), order({ ...valid(first.token), orderer: { ...orderer, email: orderer.email.toUpperCase(), phone: '01055550000' } })])
    expect(a.status).toBe(200)
    expect(b.status).toBe(200)
    const [ra, rb] = [await a.json(), await b.json()]
    expect(ra.orderNumber).toBe(rb.orderNumber)
    const payload = await localPayload()
    expect((await payload.count({ collection: 'orders', where: { idempotencyKey: { equals: `quote-${first.quoteId}` } }, overrideAccess: true })).totalDocs).toBe(1)
  })

  it('다른 주문자 정보로 보내면 409 already_ordered 이고 주문이 늘지 않는다', async () => {
    const other = { ...orderer, name: '다른고객', email: `other+${RUN}@example.com` }
    const res = await order({ ...valid(first.token), orderer: other, signature: other.name })
    expect(res.status).toBe(409)
    expect((await res.json()).reason).toBe('already_ordered')
    expect(res.headers.get('set-cookie')).toBeNull()
    const payload = await localPayload()
    expect((await payload.count({ collection: 'orders', where: { idempotencyKey: { equals: `quote-${first.quoteId}` } }, overrideAccess: true })).totalDocs).toBe(1)
  })

  it('만료된 견적은 quote_expired 로 거부한다', async () => {
    // 재발행하면 이전 견적(first)은 회수된다 — 아래 회수 테스트가 그 링크를 쓴다
    const q = await issue()
    const payload = await localPayload()
    await payload.db.pool.query("UPDATE quotes SET expires_at = now() - interval '1 minute' WHERE id = $1", [q.quoteId])
    const res = await order(valid(q.token))
    expect(res.status).toBe(400)
    expect((await res.json()).reason).toBe('quote_expired')
    expect((await payload.count({ collection: 'orders', where: { idempotencyKey: { equals: `quote-${q.quoteId}` } }, overrideAccess: true })).totalDocs).toBe(0)
  })

  it('회수된 견적은 quote_revoked 로 거부한다 — 이미 주문이 있던 링크도 마찬가지다', async () => {
    const res = await order(valid(first.token))
    expect(res.status).toBe(400)
    expect((await res.json()).reason).toBe('quote_revoked')
  })
})
