// 관리자 초대(메일 링크)를 실제 서버·DB 앞에서 고정한다. 테스트 서버는 RESEND_API_KEY 없이 뜨므로
// 메일은 나가지 않고 응답에 link 가 실린다 — 그 링크의 토큰으로 수락 흐름을 끝까지 본다.
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { localPayload } from './helpers/localApi.js'
import { api, login } from './helpers/server.js'
import { hashInviteToken } from '../src/lib/invites/token'

const RUN = Date.now()
const PW = 'Ayuta!Test-2026'
const NEW_PW = 'Invite!Pass-2026'
const base = { name: '홍길동', phone: '010-0000-0000', postalCode: '00000', address1: '서울시' }
const tokens: Record<string, string | undefined> = {}
const auth = (who?: string): Record<string, string> => (who && tokens[who] ? { Authorization: `JWT ${tokens[who]}` } : {})
const post = (path: string, body: unknown, who?: string) => api(path, { method: 'POST', headers: auth(who), body: JSON.stringify(body) })
const emailOf = (tag: string) => `inv-${tag}+${RUN}@ayuta.test`

async function invite(email: string, role = 'manager') {
  const res = await post('/api/admin/accounts/invite', { email, role }, 'super')
  const body = await res.json()
  return { status: res.status, body, token: typeof body.link === 'string' ? (body.link as string).split('/invite/')[1] : undefined }
}
const accept = (token: string | undefined, over: Record<string, string> = {}) =>
  post('/api/invite/accept', { token, name: '초대받은이', phone: '010-1111-2222', password: NEW_PW, passwordConfirm: NEW_PW, ...over })

beforeAll(async () => {
  const payload = await localPayload()
  for (const role of ['super', 'manager', 'customer'] as const) {
    const email = emailOf(`seed-${role}`)
    await payload.create({ collection: 'users', data: { email, password: PW, ...base, role }, overrideAccess: true, context: { allowRoleAssignment: true } })
    tokens[role] = (await login(email, PW)).token
  }
})

afterAll(async () => {
  const payload = await localPayload()
  await payload.delete({ collection: 'admin-invites', where: { email: { like: `+${RUN}@` } }, overrideAccess: true }).catch(() => {})
  const { docs } = await payload.find({ collection: 'users', where: { email: { like: `+${RUN}@` } }, limit: 100, overrideAccess: true })
  await payload.db.pool.query('DELETE FROM admin_login_logs WHERE user_id = ANY($1::int[])', [docs.map((d) => d.id)]).catch(() => {})
  for (const d of docs) await payload.delete({ collection: 'users', id: d.id, overrideAccess: true }).catch(() => {})
})

describe('관리자 초대', () => {
  it('최고관리자만 — 비로그인 401, 고객·중간관리자 403', async () => {
    const body = { email: emailOf('gate'), role: 'manager' }
    expect((await post('/api/admin/accounts/invite', body)).status).toBe(401)
    expect((await post('/api/admin/accounts/invite', body, 'customer')).status).toBe(403)
    expect((await post('/api/admin/accounts/invite', body, 'manager')).status).toBe(403)
  })

  it('메일 설정이 없으면 200 + link, DB 에는 해시만 남는다', async () => {
    const email = emailOf('link')
    const r = await invite(email)
    expect(r.status).toBe(200)
    expect(r.body).toMatchObject({ ok: true, sent: false })
    expect(r.token).toMatch(/^[A-Za-z0-9_-]{43}$/)
    const payload = await localPayload()
    const { docs } = await payload.find({ collection: 'admin-invites', where: { email: { equals: email } }, overrideAccess: true })
    expect(docs).toHaveLength(1)
    expect(docs[0]!.tokenHash).toBe(hashInviteToken(r.token!))
  })

  it('모르는 필드·잘못된 권한은 400, 이미 관리자면 already_admin', async () => {
    expect((await post('/api/admin/accounts/invite', { email: emailOf('x'), role: 'customer' }, 'super')).status).toBe(400)
    expect((await post('/api/admin/accounts/invite', { email: emailOf('x'), role: 'manager', password: 'x' }, 'super')).status).toBe(400)
    const r = await invite(emailOf('seed-manager'))
    expect(r.status).toBe(409)
    expect(r.body).toEqual({ error: 'already_admin' })
  })

  it('REST 로는 초대를 만들지 못하고, 조회해도 tokenHash 가 없다', async () => {
    expect((await post('/api/admin-invites', { email: emailOf('rest'), role: 'super', tokenHash: 'x', expiresAt: new Date().toISOString() }, 'super')).status).toBe(403)
    const list = await (await api('/api/admin-invites', { headers: auth('super') })).json()
    for (const d of list.docs ?? []) expect(d).not.toHaveProperty('tokenHash')
    expect((await api('/api/admin-invites', { headers: auth('manager') })).status).toBe(403)
  })

  it('약한 비밀번호는 400 weak_password, 초대는 그대로 살아 있다', async () => {
    const { token } = await invite(emailOf('weak'))
    const res = await accept(token, { password: 'short', passwordConfirm: 'short' })
    expect(res.status).toBe(400)
    expect(await res.json()).toEqual({ error: 'weak_password' })
    expect((await accept(token)).status).toBe(200)
  })

  it('수락하면 그 권한으로 로그인되고, 같은 토큰을 다시 쓰면 invalid_invite', async () => {
    const email = emailOf('ok')
    const { token } = await invite(email, 'super')
    expect(await (await api(`/ko/invite/${token}`)).text()).toContain(email)
    const res = await accept(token)
    expect(res.status).toBe(200)
    const l = await login(email, NEW_PW)
    expect(l.token).toBeTruthy()
    expect(l.body.user.role).toBe('super')
    const again = await accept(token)
    expect(again.status).toBe(400)
    expect(await again.json()).toEqual({ error: 'invalid_invite' })
  })

  it('기존 고객 이메일이면 수락 시 권한·비밀번호가 바뀐다', async () => {
    const email = emailOf('upgrade')
    const payload = await localPayload()
    await payload.create({ collection: 'users', data: { email, password: PW, ...base, role: 'customer' }, overrideAccess: true })
    const { token } = await invite(email)
    expect((await accept(token)).status).toBe(200)
    const l = await login(email, NEW_PW)
    expect(l.body.user.role).toBe('manager')
  })

  it('다시 보내면 이전 링크는 무효, 만료·없는 토큰도 같은 invalid_invite', async () => {
    const email = emailOf('resend')
    const first = await invite(email)
    const second = await invite(email)
    expect(first.token).not.toBe(second.token)
    expect(await (await accept(first.token)).json()).toEqual({ error: 'invalid_invite' })

    const payload = await localPayload()
    await payload.update({ collection: 'admin-invites', where: { email: { equals: email } }, data: { expiresAt: new Date(Date.now() - 1000).toISOString() }, overrideAccess: true })
    const expired = await accept(second.token)
    expect(expired.status).toBe(400)
    expect(await expired.json()).toEqual({ error: 'invalid_invite' })
    expect(await (await api(`/ko/invite/${second.token}`)).text()).not.toContain(email)

    expect(await (await accept('a'.repeat(43))).json()).toEqual({ error: 'invalid_invite' })
  })

  it('초대 취소하면 링크를 못 쓴다', async () => {
    const email = emailOf('cancel')
    const { token } = await invite(email)
    const payload = await localPayload()
    const { docs } = await payload.find({ collection: 'admin-invites', where: { email: { equals: email } }, overrideAccess: true })
    expect((await post('/api/admin/accounts/invite/cancel', { id: docs[0]!.id }, 'manager')).status).toBe(403)
    expect((await post('/api/admin/accounts/invite/cancel', { id: docs[0]!.id }, 'super')).status).toBe(200)
    expect(await (await accept(token)).json()).toEqual({ error: 'invalid_invite' })
  })
})
