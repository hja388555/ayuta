// 견적 발행 때 붙는 계약서 스냅샷(Q53)을 실제 서버·DB 앞에서 고정한다.
// 핵심은 하나다 — 발행 순간의 문구가 그대로 굳고, 그 뒤에는 어떤 경로로도 바뀌지 않는다.
// 고객이 읽고 동의한 글과 나중에 보이는 글이 달라지면 계약서가 아니다.
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { api, login } from './helpers/server.js'
import { localPayload } from './helpers/localApi.js'

const RUN = Date.now()
const PW = 'QuoteCt!2026'
const base = { name: '홍길동', phone: '010-0000-0000', postalCode: '00000', address1: '서울시' }

let superToken: string | undefined
let inquiryId: number
const userIds: number[] = []
const quoteIds: number[] = []

const issue = (body: unknown, token?: string) =>
  api('/api/admin/quotes', {
    method: 'POST',
    body: JSON.stringify(body),
    headers: token ? { Authorization: `JWT ${token}` } : {},
  })

beforeAll(async () => {
  const payload = await localPayload()
  const email = `quote-ct+${RUN}@ayuta.test`
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
      body: '견적 계약서 테스트 문의',
      name: '문의고객',
      phone: '010-1111-2222',
      email: `inq-ct+${RUN}@example.com`,
      locale: 'ko',
      status: 'new',
    },
    overrideAccess: true,
  })
  inquiryId = inquiry.id as number
})

afterAll(async () => {
  const payload = await localPayload()
  for (const id of quoteIds) await payload.delete({ collection: 'quotes', id, overrideAccess: true }).catch(() => {})
  await payload.delete({ collection: 'inquiries', id: inquiryId, overrideAccess: true }).catch(() => {})
  for (const id of userIds) await payload.delete({ collection: 'users', id, overrideAccess: true }).catch(() => {})
})

const lines = [{ label: '옥외 전광판 1개월', quantity: 1, unitAmount: 3_000_000 }]
const consents = [
  { key: 'agree', labelKo: '위 계약 내용에 동의합니다.', labelJa: '上記契約内容に同意します。', required: true },
]
const issueBody = (over: Record<string, unknown> = {}) => ({
  inquiryId,
  lines,
  validDays: 7,
  contractTitle: 'AYUTA 옥외 전광판 광고 서비스 계약서',
  contractBody: '제1조 (광고 내용) 갑이 신청한 광고 항목과 금액은 아래 견적 내역과 같다.\n{{items}}\n제2조 (대금) 총 금액은 {{amount}} 이다.',
  contractConsents: consents,
  ...over,
})

describe('견적 발행 계약서 스냅샷', () => {
  it('제목·본문이 비면 발행하지 못한다', async () => {
    const res = await issue(issueBody({ contractTitle: '', contractBody: '' }), superToken)
    expect(res.status).toBe(400)
    expect((await res.json()).error).toBe('contract_required')
  })

  it('동의 항목이 없으면 발행하지 못한다', async () => {
    const res = await issue(issueBody({ contractConsents: [] }), superToken)
    expect(res.status).toBe(400)
    expect((await res.json()).error).toBe('consent_required')
  })

  it('필수 동의가 하나도 없으면 발행하지 못한다', async () => {
    const res = await issue(issueBody({ contractConsents: [{ ...consents[0], required: false }] }), superToken)
    expect(res.status).toBe(400)
    expect((await res.json()).error).toBe('consent_required')
  })

  it('발행하면 그 견적에 문구와 동의 항목이 붙는다', async () => {
    const res = await issue(issueBody(), superToken)
    expect(res.status).toBe(200)
    const body = await res.json()
    quoteIds.push(body.quoteId as number)

    const payload = await localPayload()
    const row = await payload.findByID({ collection: 'quotes', id: body.quoteId as number, overrideAccess: true, depth: 0 })
    expect(row.contractTitle).toBe('AYUTA 옥외 전광판 광고 서비스 계약서')
    expect(row.contractBody as string).toContain('{{items}}')
    expect((row.contractConsents as Array<{ key: string; required: boolean }>).map((c) => c.key)).toEqual(['agree'])
  })

  it('발행한 뒤에는 문구를 바꾸지 못한다', async () => {
    const payload = await localPayload()
    const id = quoteIds[0]!
    const before = await payload.findByID({ collection: 'quotes', id, overrideAccess: true, depth: 0 })

    // 필드가 update 를 막고 있다. overrideAccess 없이 고쳐도 값이 그대로여야 한다
    await payload
      .update({ collection: 'quotes', id, data: { contractBody: '바꿔치기한 계약서' }, overrideAccess: false })
      .catch(() => null)

    const after = await payload.findByID({ collection: 'quotes', id, overrideAccess: true, depth: 0 })
    expect(after.contractBody).toBe(before.contractBody)
  })

  it('회수하고 다시 발행하면 새 문구로 새 견적이 생긴다', async () => {
    const res = await issue(issueBody({ contractTitle: '다시 발행한 계약서' }), superToken)
    expect(res.status).toBe(200)
    const body = await res.json()
    quoteIds.push(body.quoteId as number)
    // 같은 문의의 살아 있는 견적은 발행 때 회수된다
    expect(body.revokedCount).toBeGreaterThanOrEqual(1)

    const payload = await localPayload()
    const row = await payload.findByID({ collection: 'quotes', id: body.quoteId as number, overrideAccess: true, depth: 0 })
    expect(row.contractTitle).toBe('다시 발행한 계약서')
  })

  it('로그인하지 않으면 발행하지 못한다', async () => {
    expect((await issue(issueBody())).status).toBe(401)
  })
})
