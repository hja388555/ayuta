// "로그인 상태 유지"(POST /api/auth/login)가 쿠키 수명만이 아니라 서버에서 세션 길이를 강제하는지 확인한다.
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { api } from './helpers/server.js'
import { localPayload } from './helpers/localApi.js'

const RUN = Date.now()
const PW = 'Ayuta!Test-2026'
const base = { name: '홍길동', phone: '010-0000-0000', postalCode: '00000', address1: '서울시' }
const CUST = `keep-cust+${RUN}@ayuta.test`
const MANAGER = `keep-mgr+${RUN}@ayuta.test`
const LOCK = `keep-lock+${RUN}@ayuta.test`

const HOUR = 3600
const createdIds: number[] = []

type Sess = { id: string; expiresAt: string | Date }

const loginKeep = (email: string, password: string, keep?: boolean) =>
  api('/api/auth/login', { method: 'POST', body: JSON.stringify(keep === undefined ? { email, password } : { email, password, keep }) })

/** set-cookie 에서 payload-token 쿠키 한 줄과 토큰·속성을 뽑는다 */
const tokenCookie = (res: Response) => {
  const line = res.headers.getSetCookie().find((c) => c.startsWith('payload-token=')) ?? ''
  const token = line.split(';')[0]!.slice('payload-token='.length)
  const attrs = line.toLowerCase()
  const maxAge = /max-age=(\d+)/.exec(attrs)?.[1]
  return { line, token, attrs, maxAge: maxAge ? Number(maxAge) : undefined }
}

const claims = (token: string) => JSON.parse(Buffer.from(token.split('.')[1]!, 'base64url').toString('utf8')) as { sid: string; exp: number; iat: number }

const me = async (token: string) => {
  const res = await api('/api/users/me', { headers: { Cookie: `payload-token=${token}` } })
  return (await res.json()) as { user: { email: string } | null }
}

const dbUser = async (email: string) => {
  const payload = await localPayload()
  return (await payload.db.findOne({ collection: 'users', where: { email: { equals: email } } })) as unknown as {
    id: number
    sessions?: Sess[]
    loginAttempts?: number
  }
}

const sessionSeconds = async (email: string, sid: string) => {
  const s = (await dbUser(email)).sessions?.find((x) => x.id === sid)
  expect(s).toBeTruthy()
  return (new Date(s!.expiresAt).getTime() - Date.now()) / 1000
}

const near = (actual: number, expected: number, slack = 120) => {
  expect(actual).toBeGreaterThan(expected - slack)
  expect(actual).toBeLessThanOrEqual(expected + 5)
}

beforeAll(async () => {
  const payload = await localPayload()
  for (const [email, role] of [
    [CUST, 'customer'],
    [LOCK, 'customer'],
    [MANAGER, 'manager'],
  ] as const) {
    const u = await payload.create({ collection: 'users', data: { email, password: PW, ...base, role }, overrideAccess: true, context: { allowRoleAssignment: true } })
    createdIds.push(u.id as number)
  }
})

afterAll(async () => {
  const payload = await localPayload()
  // 관리자 로그인 기록이 users 를 참조하므로 먼저 지운다
  await payload.delete({ collection: 'admin-login-logs', where: { user: { in: createdIds } }, overrideAccess: true })
  for (const id of createdIds) await payload.delete({ collection: 'users', id, overrideAccess: true })
})

describe('POST /api/auth/login — 로그인 상태 유지', () => {
  it('유지 안 함: 세션 쿠키(Max-Age·Expires 없음), 세션·토큰 2시간, 인증된다', async () => {
    const res = await loginKeep(CUST, PW)
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.user).toMatchObject({ email: CUST, role: 'customer' })
    expect(body.token).toBeUndefined()
    const c = tokenCookie(res)
    expect(c.token).toBeTruthy()
    expect(c.maxAge).toBeUndefined()
    expect(c.attrs).not.toContain('expires=')
    expect(c.attrs).toContain('httponly')
    expect(c.attrs).toContain('samesite=lax')
    expect(c.attrs).toContain('path=/')
    const { sid, exp, iat } = claims(c.token)
    expect(exp - iat).toBe(2 * HOUR)
    near(await sessionSeconds(CUST, sid), 2 * HOUR)
    expect((await me(c.token)).user?.email).toBe(CUST)
  })

  it('keep:false 명시도 같다', async () => {
    const res = await loginKeep(CUST, PW, false)
    expect(res.status).toBe(200)
    expect(tokenCookie(res).maxAge).toBeUndefined()
  })

  it('고객 유지: Max-Age 30일, 세션·토큰 30일, 인증된다', async () => {
    const res = await loginKeep(CUST, PW, true)
    expect(res.status).toBe(200)
    const c = tokenCookie(res)
    expect(c.maxAge).toBe(30 * 24 * HOUR)
    const { sid, exp, iat } = claims(c.token)
    expect(exp - iat).toBe(30 * 24 * HOUR)
    near(await sessionSeconds(CUST, sid), 30 * 24 * HOUR)
    expect((await me(c.token)).user?.email).toBe(CUST)
  })

  it('관리자 유지: 12시간 상한, /manage 통과', async () => {
    const res = await loginKeep(MANAGER, PW, true)
    expect(res.status).toBe(200)
    expect((await res.json()).user.role).toBe('manager')
    const c = tokenCookie(res)
    expect(c.maxAge).toBe(12 * HOUR)
    const { sid, exp, iat } = claims(c.token)
    expect(exp - iat).toBe(12 * HOUR)
    near(await sessionSeconds(MANAGER, sid), 12 * HOUR)
    const manage = await api('/manage', { redirect: 'manual', headers: { Cookie: `payload-token=${c.token}` } })
    expect(manage.status).toBe(200)
  })

  it('관리자 유지 안 함: 2시간·세션 쿠키', async () => {
    const res = await loginKeep(MANAGER, PW)
    const c = tokenCookie(res)
    expect(c.maxAge).toBeUndefined()
    near(await sessionSeconds(MANAGER, claims(c.token).sid), 2 * HOUR)
  })

  it('세션 만료 시각이 지나면 JWT exp 가 남아 있어도 거절된다', async () => {
    const res = await loginKeep(CUST, PW, true)
    const { token } = tokenCookie(res)
    const { sid } = claims(token)
    expect((await me(token)).user?.email).toBe(CUST)

    const payload = await localPayload()
    const doc = (await payload.db.findOne({ collection: 'users', where: { email: { equals: CUST } } })) as unknown as { id: number; sessions: Sess[] }
    await payload.db.updateOne({
      collection: 'users',
      id: doc.id,
      data: { ...doc, updatedAt: null, sessions: doc.sessions.map((s) => (s.id === sid ? { ...s, expiresAt: new Date(Date.now() - 1000) } : s)) },
      returning: false,
    })
    expect((await me(token)).user).toBeNull()
    const mypage = await api('/api/me/password', { method: 'POST', headers: { Cookie: `payload-token=${token}` }, body: '{}' })
    expect(mypage.status).toBe(401)
  })

  it('틀린 비밀번호는 일반 실패(401)이고 실패 횟수에 들어가 5회에 잠긴다', async () => {
    const first = await loginKeep(LOCK, 'wrong-password', true)
    expect(first.status).toBe(401)
    expect(await first.json()).toEqual({ error: 'login_failed' })
    expect(first.headers.getSetCookie().some((c) => c.startsWith('payload-token='))).toBe(false)
    expect((await dbUser(LOCK)).loginAttempts).toBe(1)
    for (let i = 0; i < 4; i++) expect((await loginKeep(LOCK, 'wrong-password')).status).toBe(401)
    // 잠긴 뒤에는 맞는 비밀번호도 실패
    expect((await loginKeep(LOCK, PW, true)).status).toBe(401)
  })

  it('없는 계정·잘못된 입력', async () => {
    expect((await loginKeep(`nobody+${RUN}@ayuta.test`, PW)).status).toBe(401)
    expect((await api('/api/auth/login', { method: 'POST', body: JSON.stringify({ email: CUST, password: PW, keep: 'yes' }) })).status).toBe(400)
    expect((await api('/api/auth/login', { method: 'POST', body: 'nope' })).status).toBe(400)
    const form = await api('/api/auth/login', { method: 'POST', headers: { 'Content-Type': 'text/plain' }, body: JSON.stringify({ email: CUST, password: PW }) })
    expect(form.status).toBe(415)
  })

  it('로그아웃하면 쿠키가 지워지고 그 세션 토큰은 더는 인증되지 않는다', async () => {
    const res = await loginKeep(CUST, PW, true)
    const { token } = tokenCookie(res)
    const { sid } = claims(token)
    const out = await api('/api/users/logout', { method: 'POST', headers: { Cookie: `payload-token=${token}` } })
    expect(out.status).toBe(200)
    const cleared = tokenCookie(out)
    expect(cleared.line).toBeTruthy()
    expect(cleared.token).toBe('')
    expect((await dbUser(CUST)).sessions?.some((s) => s.id === sid)).toBe(false)
    expect((await me(token)).user).toBeNull()
  })

  it('Payload 기본 /api/users/login 은 그대로 2시간이다(긴 세션은 이 경로로만)', async () => {
    const res = await api('/api/users/login', { method: 'POST', body: JSON.stringify({ email: CUST, password: PW, keep: true }) })
    expect(res.status).toBe(200)
    const { token } = await res.json()
    const { sid, exp, iat } = claims(token)
    expect(exp - iat).toBe(2 * HOUR)
    near(await sessionSeconds(CUST, sid), 2 * HOUR)
  })
})
