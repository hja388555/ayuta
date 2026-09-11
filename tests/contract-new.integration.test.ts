// 아직 없는 계약서(5번 기타 광고)를 관리자 화면에서 처음 만드는 흐름(Q38, 사용자 결정 A)을 서버·DB 앞에서 고정한다:
// 최고관리자만 만들 수 있고, 채울 수 없는 빈칸·동의 항목 조작은 거절, 이미 있으면 409, 만들면 바로 게시된다.
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

// 공유 로컬 DB 에 5번(ja)이 이미 있으면 그 행을 잠시 치웠다가 끝나면 되돌린다
let saved: Record<string, unknown> | null = null
let createdId: number | null = null
const draft = () => ({ target: 'contract-new', category: 5, locale: 'ja', title: `テスト契約書 ${RUN}`, body: `第1条 目的\n本契約はテストです ${RUN}。金額 {{amount}}` })

beforeAll(async () => {
  const payload = await localPayload()
  for (const role of ['super', 'manager'] as const) {
    const email = `contract-new-${role}+${RUN}@ayuta.test`
    const u = await payload.create({ collection: 'users', data: { email, password: PW, ...base, role }, overrideAccess: true, context: { allowRoleAssignment: true } })
    userIds.push(u.id as number)
    tokens[role] = (await login(email, PW)).token
  }
  const { docs } = await payload.find({ collection: 'contract-templates', where: { and: [{ category: { equals: 5 } }, { locale: { equals: 'ja' } }] }, limit: 1, depth: 0, overrideAccess: true })
  if (docs[0]) {
    saved = { category: 5, locale: 'ja', title: docs[0].title, body: docs[0].body, consents: docs[0].consents, active: docs[0].active }
    await payload.delete({ collection: 'contract-templates', id: docs[0].id, overrideAccess: true })
  }
})

afterAll(async () => {
  const payload = await localPayload()
  if (createdId) await payload.delete({ collection: 'contract-templates', id: createdId, overrideAccess: true }).catch(() => {})
  if (saved) await payload.create({ collection: 'contract-templates', data: saved as never, overrideAccess: true }).catch(() => {})
  await payload.db.pool.query('DELETE FROM legal_revisions WHERE body LIKE $1 OR title LIKE $1', [`%${RUN}%`]).catch(() => {})
  for (const id of userIds) await payload.delete({ collection: 'users', id, overrideAccess: true }).catch(() => {})
})

describe('관리자 화면에서 없는 계약서 만들기', () => {
  it('중간관리자·비로그인은 만들 수 없다', async () => {
    expect((await post(draft(), 'manager')).status).toBeGreaterThanOrEqual(401)
    expect((await post(draft())).status).toBeGreaterThanOrEqual(401)
  })

  it('채울 수 없는 빈칸이 있으면 거절한다', async () => {
    const res = await post({ ...draft(), body: `${draft().body} {{nope_${RUN}}}` }, 'super')
    expect(res.status).toBe(400)
    expect((await res.json()).error).toBe('unknown_placeholder')
  })

  it('동의 항목 key·개수를 바꾸면 거절한다', async () => {
    const res = await post({ ...draft(), consents: [{ key: 'other', label: 'x' }] }, 'super')
    expect(res.status).toBe(400)
    expect((await res.json()).error).toBe('consent_keys_mismatch')
  })

  it('최고관리자가 만들면 기본 동의 항목과 함께 바로 게시된다', async () => {
    const res = await post({ ...draft(), consents: [{ key: 'agree', label: `同意します ${RUN}` }] }, 'super')
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.ok).toBe(true)
    createdId = json.id
    const payload = await localPayload()
    const doc = await payload.findByID({ collection: 'contract-templates', id: createdId!, depth: 0, overrideAccess: true })
    expect(doc.active).toBe(true)
    expect(doc.category).toBe(5)
    expect((doc.consents as Array<{ key: string; label: string; required: boolean }>).map(({ key, label, required }) => ({ key, label, required }))).toEqual([
      { key: 'agree', label: `同意します ${RUN}`, required: true },
    ])
  })

  it('이미 있으면 새로 만들지 않고 409', async () => {
    const res = await post(draft(), 'super')
    expect(res.status).toBe(409)
    expect((await res.json()).error).toBe('contract_exists')
  })
})
