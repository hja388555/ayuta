// 계약서·약관 관리(큐 Q25 2차)를 실제 서버·DB 앞에서 고정한다: 저장은 최고관리자만, 채울 수 없는
// 빈칸은 거절, 저장하면 공개 화면·다음 계약서에 반영되고 수정 이력이 남는지.
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
// localApi 를 먼저 — .env 를 읽기 전에 payload config 를 가져오면 "missing secret key"
import { localPayload } from './helpers/localApi.js'
import { api, login } from './helpers/server.js'

const RUN = Date.now()
const PW = 'Ayuta!Test-2026'
const base = { name: '홍길동', phone: '010-0000-0000', postalCode: '00000', address1: '서울시' }
const userIds: number[] = []
const tokens: Record<string, string | undefined> = {}
const auth = (who?: string): Record<string, string> => (who && tokens[who] ? { Authorization: `JWT ${tokens[who]}` } : {})
const post = (body: unknown, who?: string) => api('/api/admin/legal', { method: 'POST', headers: auth(who), body: JSON.stringify(body) })

let contract: { id: number; title: string; body: string }
let privacyJaBefore: { id: number; title: string; body: string } | null = null
const createdDocIds: number[] = []

beforeAll(async () => {
  const payload = await localPayload()
  for (const role of ['super', 'manager', 'customer'] as const) {
    const email = `legal-${role}+${RUN}@ayuta.test`
    const u = await payload.create({ collection: 'users', data: { email, password: PW, ...base, role }, overrideAccess: true, context: { allowRoleAssignment: true } })
    userIds.push(u.id as number)
    tokens[role] = (await login(email, PW)).token
  }
  const { docs } = await payload.find({ collection: 'contract-templates', where: { and: [{ category: { equals: 1 } }, { locale: { equals: 'ko' } }] }, limit: 1, overrideAccess: true })
  if (!docs[0]) throw new Error('1번 계약서(ko) 시드가 없다 — pnpm seed:contracts 먼저')
  contract = { id: docs[0].id as number, title: docs[0].title, body: docs[0].body }
  const existing = await payload.find({ collection: 'legal-documents', where: { and: [{ kind: { equals: 'privacy' } }, { locale: { equals: 'ja' } }] }, limit: 1, overrideAccess: true })
  if (existing.docs[0]) privacyJaBefore = { id: existing.docs[0].id as number, title: existing.docs[0].title, body: existing.docs[0].body }
})

afterAll(async () => {
  const payload = await localPayload()
  // 원래 문구로 되돌린다. 테스트가 만든 이력은 지운다(append-only 는 API 기준 — 정리는 DB 로)
  if (contract) await payload.update({ collection: 'contract-templates', id: contract.id, data: { title: contract.title, body: contract.body }, overrideAccess: true }).catch(() => {})
  if (privacyJaBefore) {
    await payload.update({ collection: 'legal-documents', id: privacyJaBefore.id, data: { title: privacyJaBefore.title, body: privacyJaBefore.body }, overrideAccess: true }).catch(() => {})
  }
  const { docs } = await payload.find({ collection: 'legal-documents', where: { and: [{ kind: { equals: 'privacy' } }, { locale: { equals: 'ja' } }] }, limit: 1, overrideAccess: true })
  if (!privacyJaBefore && docs[0]) createdDocIds.push(docs[0].id as number)
  await payload.db.pool.query('DELETE FROM legal_revisions WHERE body LIKE $1 OR title LIKE $1', [`%${RUN}%`]).catch(() => {})
  for (const id of createdDocIds) await payload.db.pool.query('DELETE FROM legal_documents WHERE id = $1', [id]).catch(() => {})
  await payload.db.pool.query('DELETE FROM admin_login_logs WHERE user_id = ANY($1::int[])', [userIds]).catch(() => {})
  for (const id of userIds) await payload.delete({ collection: 'users', id, overrideAccess: true }).catch(() => {})
})

describe('계약서·약관 저장 권한', () => {
  it('비로그인 401, 고객·중간관리자 403', async () => {
    const body = { target: 'document', kind: 'privacy', locale: 'ja', title: 't', body: 'b' }
    expect((await post(body)).status).toBe(401)
    expect((await post(body, 'customer')).status).toBe(403)
    expect((await post(body, 'manager')).status).toBe(403)
  })

  it('Payload REST 로 직접 고치는 길도 막혀 있다(중간관리자)', async () => {
    const res = await api(`/api/contract-templates/${contract.id}`, { method: 'PATCH', headers: auth('manager'), body: JSON.stringify({ title: `x${RUN}` }) })
    expect(res.status).toBe(403)
  })
})

describe('계약서 수정', () => {
  it('채울 수 없는 빈칸이 있으면 거절하고 어떤 빈칸인지 알려준다', async () => {
    const res = await post({ target: 'contract', id: contract.id, title: contract.title, body: `${contract.body}\n{{amout}}` }, 'super')
    expect(res.status).toBe(400)
    expect(await res.json()).toMatchObject({ error: 'unknown_placeholder', detail: ['amout'] })
  })

  it('저장하면 원문이 바뀌고 수정자와 함께 이력이 남는다', async () => {
    const title = `${contract.title} ${RUN}`
    const res = await post({ target: 'contract', id: contract.id, title, body: contract.body }, 'super')
    expect(res.status).toBe(200)
    const payload = await localPayload()
    const row = await payload.findByID({ collection: 'contract-templates', id: contract.id, overrideAccess: true })
    expect(row.title).toBe(title)
    const { docs } = await payload.find({ collection: 'legal-revisions', where: { and: [{ target: { equals: 'contract-templates' } }, { docId: { equals: contract.id } }] }, sort: '-at', limit: 1, overrideAccess: true })
    expect(docs[0]).toMatchObject({ title, editorEmail: `legal-super+${RUN}@ayuta.test`, label: '1번 계약서 (ko)' })
  })
})

describe('약관 문서', () => {
  it('저장하면 공개 화면에 그대로 나오고 이력이 남는다', async () => {
    const body = `テスト本文 ${RUN}\n第1条`
    expect((await post({ target: 'document', kind: 'privacy', locale: 'ja', title: `個人情報 ${RUN}`, body }, 'super')).status).toBe(200)
    const html = await (await api('/ja/privacy')).text()
    expect(html).toContain(`テスト本文 ${RUN}`)
    const payload = await localPayload()
    const { docs } = await payload.find({ collection: 'legal-revisions', where: { title: { equals: `個人情報 ${RUN}` } }, limit: 1, overrideAccess: true })
    expect(docs[0]?.label).toBe('개인정보처리방침 (ja)')
  })

  it('이용약관 화면이 열리고 푸터·가입 화면이 약관을 가리킨다', async () => {
    expect((await api('/ko/terms')).status).toBe(200)
    const home = await (await api('/ko')).text()
    expect(home).toContain('href="/ko/terms"')
    expect(home).toContain('href="/ko/privacy"')
    const signup = await (await api('/ko/signup')).text()
    expect(signup).toContain('href="/ko/terms"')
  })

  it('수정 이력은 고객이 REST 로 읽을 수 없다', async () => {
    const res = await api('/api/legal-revisions', { headers: auth('customer') })
    const json = await res.json()
    expect(res.status === 403 || (Array.isArray(json.docs) && json.docs.length === 0)).toBe(true)
  })
})
