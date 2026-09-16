// 견적별 계약서가 고객 화면 → 결제 → 주문 스냅샷까지 이어지는지 확인한다(Q53 Task 9).
// 핵심은 하나다 — 고객이 견적 화면에서 본 문구와 동의 항목이, 주문에 그대로 남는다.
// 관리자가 나중에 문구를 고쳐도 이미 결제한 주문은 그때 읽고 동의한 글 그대로여야 한다.
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { api, login } from './helpers/server.js'
import { localPayload } from './helpers/localApi.js'

const RUN = Date.now()
const PW = 'QtOrder!2026'
const base = { name: '홍길동', phone: '010-0000-0000', postalCode: '00000', address1: '서울시' }

let superToken: string | undefined
let inquiryId: number
let token: string
let quoteId: number
const userIds: number[] = []
const orderIds: number[] = []

const QUOTE_CONSENT = {
  key: 'quoteonly',
  labelKo: '이 견적에만 있는 특약에 동의합니다.',
  labelJa: 'この見積のみの特約に同意します。',
  required: true,
}

const orderer = {
  name: `견적주문${RUN}`,
  phone: '010-5555-6666',
  email: `qorder+${RUN}@example.com`,
  postalCode: '12345',
  address1: '서울시 강남구',
}

beforeAll(async () => {
  const payload = await localPayload()
  const email = `qorder-super+${RUN}@ayuta.test`
  const u = await payload.create({
    collection: 'users',
    data: { email, password: PW, ...base, role: 'super' },
    overrideAccess: true,
    context: { allowRoleAssignment: true },
  })
  userIds.push(u.id as number)
  superToken = (await login(email, PW)).token

  const inquiry = await payload.create({
    collection: 'inquiries',
    data: {
      body: '견적 계약서 → 주문 스냅샷 테스트',
      name: '문의고객',
      phone: '010-1111-2222',
      email: `inq-qo+${RUN}@example.com`,
      locale: 'ko',
      status: 'new',
    },
    overrideAccess: true,
  })
  inquiryId = inquiry.id as number

  const res = await api('/api/admin/quotes', {
    method: 'POST',
    headers: { Authorization: `JWT ${superToken}` },
    body: JSON.stringify({
      inquiryId,
      lines: [{ label: '옥외 전광판 1개월', quantity: 1, unitAmount: 1_000_000 }],
      validDays: 7,
      contractTitle: 'AYUTA 견적 계약서',
      contractBody: '제1조 갑이 신청한 광고 항목과 금액은 {{items}} · {{amount}} 와 같다.\n갑: {{buyerName}}\n전자서명: {{signature}}',
      contractConsents: [QUOTE_CONSENT],
    }),
  })
  if (res.status !== 200) throw new Error(`견적 발행 실패: ${res.status} ${await res.text()}`)
  const body = await res.json()
  quoteId = body.quoteId as number
  token = (body.path as string).split('/').pop() as string
})

afterAll(async () => {
  const payload = await localPayload()
  for (const id of orderIds) await payload.delete({ collection: 'orders', id, overrideAccess: true }).catch(() => {})
  await payload.delete({ collection: 'quotes', id: quoteId, overrideAccess: true }).catch(() => {})
  await payload.delete({ collection: 'inquiries', id: inquiryId, overrideAccess: true }).catch(() => {})
  for (const id of userIds) await payload.delete({ collection: 'users', id, overrideAccess: true }).catch(() => {})
})

describe('견적 계약서 → 주문 스냅샷', () => {
  it('고객 견적 화면에 그 견적의 문구가 보인다', async () => {
    const res = await api(`/ko/quote/${token}`)
    expect(res.status).toBe(200)
    const html = await res.text()
    expect(html).toContain('이 견적에만 있는 특약에 동의합니다.')
  })

  it('견적 동의를 체크하지 않으면 결제되지 않는다', async () => {
    const res = await api('/api/quote/order', {
      method: 'POST',
      body: JSON.stringify({
        token,
        locale: 'ko',
        consents: { terms: true, privacy: true },
        orderer,
        signature: orderer.name,
      }),
    })
    expect(res.status).toBe(400)
  })

  it('결제하면 그 견적의 동의가 문구째로 주문에 남는다', async () => {
    const res = await api('/api/quote/order', {
      method: 'POST',
      body: JSON.stringify({
        token,
        locale: 'ko',
        consents: { terms: true, privacy: true, [QUOTE_CONSENT.key]: true },
        orderer,
        signature: orderer.name,
      }),
    })
    expect(res.status).toBe(200)
    const body = await res.json()
    orderIds.push(body.orderId as number)

    const payload = await localPayload()
    const order = await payload.findByID({ collection: 'orders', id: body.orderId as number, overrideAccess: true, depth: 0 })
    const snapshot = order.consentSnapshot as Array<{ key: string; label: string; required: boolean; agreed: boolean }>

    // 이용 약관·개인정보는 모든 결제에 공통으로 붙고, 그 뒤에 이 견적의 항목이 온다
    expect(snapshot.map((c) => c.key)).toEqual(['terms', 'privacy', QUOTE_CONSENT.key])
    expect(snapshot.find((c) => c.key === QUOTE_CONSENT.key)?.label).toBe(QUOTE_CONSENT.labelKo)
    expect(snapshot.every((c) => c.agreed)).toBe(true)
  })

  it('주문에 남은 동의는 나중에 바뀌지 않는다', async () => {
    const payload = await localPayload()
    const id = orderIds[0]!
    const before = await payload.findByID({ collection: 'orders', id, overrideAccess: true, depth: 0 })

    await payload
      .update({ collection: 'orders', id, data: { consentSnapshot: [] }, overrideAccess: false })
      .catch(() => null)

    const after = await payload.findByID({ collection: 'orders', id, overrideAccess: true, depth: 0 })
    expect((after.consentSnapshot as unknown[]).length).toBe((before.consentSnapshot as unknown[]).length)
  })
})
