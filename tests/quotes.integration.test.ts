// 5번 견적 발행(POST /api/admin/quotes)·회수와 고객 견적 화면(/quote/[token])을 실제 서버·DB
// 앞에서 고정한다. 금액이 서버 계산인지, 토큰 원문이 DB 에 남지 않는지, 재발행·회수·만료 뒤
// 이전 링크가 막히는지를 본다.
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { BASE, api, login } from './helpers/server.js'
import { localPayload } from './helpers/localApi.js'

const RUN = Date.now()
const PW = 'Ayuta!Test-2026'
const base = { name: '홍길동', phone: '010-0000-0000', postalCode: '00000', address1: '서울시' }
const marker = `견적테스트-${RUN}`

const userIds: number[] = []
const tokens: Record<string, string | undefined> = {}
let inquiryId: number

const auth = (who?: string): Record<string, string> => (who && tokens[who] ? { Authorization: `JWT ${tokens[who]}` } : {})
const issue = (body: unknown, who?: string) => api('/api/admin/quotes', { method: 'POST', headers: auth(who), body: JSON.stringify(body) })
const revoke = (quoteId: number, who?: string) => api('/api/admin/quotes/revoke', { method: 'POST', headers: auth(who), body: JSON.stringify({ quoteId }) })
const lines = [
  { label: '현수막 제작', quantity: 2, unitAmount: 150_000 },
  { label: '설치', quantity: 1, unitAmount: 50_000 },
]

beforeAll(async () => {
  const payload = await localPayload()
  for (const [name, role] of [
    ['customer', 'customer'],
    ['manager', 'manager'],
  ] as const) {
    const email = `quote-${name}+${RUN}@ayuta.test`
    const u = await payload.create({
      collection: 'users',
      data: { email, password: PW, ...base, role },
      overrideAccess: true,
      context: { allowRoleAssignment: true },
    })
    userIds.push(u.id as number)
    tokens[name] = (await login(email, PW)).token
  }
  const fd = new FormData()
  for (const [k, v] of Object.entries({ type: 'other', body: marker, name: '견적고객', phone: '010-5555-0000', email: `quote+${RUN}@example.com`, locale: 'ko' })) fd.set(k, v)
  const res = await fetch(`${BASE}/api/inquiry`, { method: 'POST', body: fd })
  inquiryId = (await res.json()).inquiryId
})

afterAll(async () => {
  const payload = await localPayload()
  await payload.db.pool.query('DELETE FROM quotes_lines WHERE _parent_id IN (SELECT id FROM quotes WHERE inquiry_id = $1)', [inquiryId]).catch(() => {})
  await payload.db.pool.query('DELETE FROM quotes WHERE inquiry_id = $1', [inquiryId]).catch(() => {})
  await payload.db.pool.query('DELETE FROM inquiries WHERE id = $1', [inquiryId]).catch(() => {})
  for (const id of userIds) await payload.delete({ collection: 'users', id, overrideAccess: true }).catch(() => {})
})

describe('POST /api/admin/quotes — 발행', () => {
  it('비로그인 401, 고객 403 이고 견적이 만들어지지 않는다', async () => {
    expect((await issue({ inquiryId, lines })).status).toBe(401)
    expect((await issue({ inquiryId, lines }, 'customer')).status).toBe(403)
    const payload = await localPayload()
    expect((await payload.count({ collection: 'quotes', where: { inquiry: { equals: inquiryId } }, overrideAccess: true })).totalDocs).toBe(0)
  })

  it('잘못된 라인(소수·음수·빈 목록·합계 0)은 400 이다', async () => {
    for (const bad of [
      [{ label: 'x', quantity: 1, unitAmount: 1000.5 }],
      [{ label: 'x', quantity: 1, unitAmount: -1 }],
      [],
      [{ label: 'x', quantity: 1, unitAmount: 0 }],
    ]) {
      const res = await issue({ inquiryId, lines: bad }, 'manager')
      expect(res.status).toBe(400)
    }
  })

  it('관리자가 발행하면 링크가 나오고, 합계는 서버가 계산하며, 토큰 원문은 DB 에 없다', async () => {
    const res = await issue({ inquiryId, lines, total: 1 }, 'manager')
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.path).toMatch(/^\/ko\/quote\/[A-Za-z0-9_-]{22}$/)
    const token = body.path.split('/').pop()

    const payload = await localPayload()
    const q = await payload.findByID({ collection: 'quotes', id: body.quoteId, overrideAccess: true, showHiddenFields: true })
    expect(q.total).toBe(350_000)
    expect(q.currency).toBe('KRW')
    const raw = await payload.db.pool.query('SELECT count(*)::int AS n FROM quotes WHERE token_hash = $1', [token])
    expect(raw.rows[0].n).toBe(0)
    const inquiry = await payload.findByID({ collection: 'inquiries', id: inquiryId, overrideAccess: true })
    expect(inquiry.status).toBe('quoted')

    const page = await api(body.path)
    expect(page.status).toBe(200)
    const html = await page.text()
    expect(html).toContain(body.quoteNumber)
    expect(html).toContain('현수막 제작')
    expect(html).toContain('350,000')
    expect(html).toContain('결제 준비 중입니다')
  })

  it('재발행하면 이전 링크는 회수 안내로 바뀐다 — 링크 두 개가 동시에 살아 있지 않다', async () => {
    const first = await (await issue({ inquiryId, lines }, 'manager')).json()
    const second = await (await issue({ inquiryId, lines: [{ label: '수정 견적', quantity: 1, unitAmount: 90_000 }] }, 'manager')).json()
    expect(second.revokedCount).toBeGreaterThanOrEqual(1)
    expect(await (await api(first.path)).text()).toContain('회수된 견적입니다')
    expect(await (await api(second.path)).text()).toContain('수정 견적')
  })
})

describe('견적 링크 상태', () => {
  it('회수하면 즉시 회수 안내가 나오고, 두 번 회수하면 400 이다', async () => {
    const q = await (await issue({ inquiryId, lines }, 'manager')).json()
    expect((await revoke(q.quoteId, 'customer')).status).toBe(403)
    expect((await revoke(q.quoteId, 'manager')).status).toBe(200)
    expect(await (await api(q.path)).text()).toContain('회수된 견적입니다')
    expect((await revoke(q.quoteId, 'manager')).status).toBe(400)
  })

  it('유효기간이 지나면 만료 안내가 나온다', async () => {
    const q = await (await issue({ inquiryId, lines }, 'manager')).json()
    const payload = await localPayload()
    await payload.db.pool.query("UPDATE quotes SET expires_at = now() - interval '1 minute' WHERE id = $1", [q.quoteId])
    expect(await (await api(q.path)).text()).toContain('견적 유효기간이 지났습니다')
  })

  it('없는 토큰·모양이 틀린 토큰은 같은 안내 하나로만 답한다', async () => {
    const unknown = await (await api('/ko/quote/AAAAAAAAAAAAAAAAAAAAAA')).text()
    const malformed = await (await api('/ko/quote/not-a-token')).text()
    expect(unknown).toContain('유효하지 않은 견적 링크입니다')
    expect(malformed).toContain('유효하지 않은 견적 링크입니다')
  })

  it('견적 화면은 검색 엔진에 노출되지 않는다', async () => {
    const q = await (await issue({ inquiryId, lines }, 'manager')).json()
    const html = await (await api(q.path)).text()
    expect(html).toMatch(/<meta name="robots" content="noindex, ?nofollow"/)
  })
})

describe('Payload REST 로 견적을 만들거나 고칠 수 없다', () => {
  it('POST /api/quotes 는 관리자도 403 이다 — 합계 재계산·이전 링크 회수를 건너뛰지 못하게', async () => {
    const res = await api('/api/quotes', { method: 'POST', headers: auth('manager'), body: JSON.stringify({ quoteNumber: 'X', inquiry: inquiryId, lines, currency: 'KRW', total: 1, tokenHash: 'x', issuedAt: new Date().toISOString(), expiresAt: new Date().toISOString() }) })
    expect(res.status).toBe(403)
  })
})
