// 관리자 로그인 → 2단계 코드 발급 → 코드 입력 경로를 실제 서버·DB 앞에서 고정한다.
// 코드는 메일(개발 중에는 서버 로그)로만 나가므로 테스트는 발급 API 로 코드를 알 수 없다 —
// 발급 동작(행 생성·상한)과 확인 동작(알려진 코드를 직접 심어 입력)을 나눠 검증한다.
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { api, login } from './helpers/server.js'
import { localPayload } from './helpers/localApi.js'
import { hashOtp, newSalt } from '../src/lib/admin-otp'

const RUN = Date.now()
const PW = 'Ayuta!Test-2026'
const base = { name: '홍길동', phone: '010-0000-0000', postalCode: '00000', address1: '서울시' }
const MANAGER = { email: `otp-mgr+${RUN}@ayuta.test` }
const LIMITED = { email: `otp-limit+${RUN}@ayuta.test` }
const CUSTOMER = { email: `otp-cust+${RUN}@ayuta.test` }

const userIds: Record<string, number> = {}
const tokens: Record<string, string | undefined> = {}

const auth = (token?: string): Record<string, string> => (token ? { Authorization: `JWT ${token}` } : {})
const issue = (token?: string) => api('/api/admin/otp/issue', { method: 'POST', headers: auth(token) })
const verify = (code: unknown, token?: string) =>
  api('/api/admin/otp/verify', { method: 'POST', headers: auth(token), body: JSON.stringify({ code }) })

const otpRows = async (userId: number) => {
  const payload = await localPayload()
  const { docs } = await payload.find({ collection: 'admin-otps', where: { user: { equals: userId } }, limit: 100, overrideAccess: true })
  return docs
}

const plantCode = async (userId: number, code: string) => {
  const payload = await localPayload()
  const salt = newSalt()
  await payload.create({
    collection: 'admin-otps',
    data: { user: userId, hash: hashOtp(code, salt), salt, expiresAt: new Date(Date.now() + 10 * 60 * 1000).toISOString(), attempts: 0 },
    overrideAccess: true,
  })
}

beforeAll(async () => {
  const payload = await localPayload()
  for (const [name, creds, role] of [
    ['manager', MANAGER, 'manager'],
    ['limited', LIMITED, 'manager'],
    ['customer', CUSTOMER, 'customer'],
  ] as const) {
    const u = await payload.create({
      collection: 'users',
      data: { email: creds.email, password: PW, ...base, role },
      overrideAccess: true,
      context: { allowRoleAssignment: true },
    })
    userIds[name] = u.id as number
    tokens[name] = (await login(creds.email, PW)).token
  }
})

afterAll(async () => {
  const payload = await localPayload()
  const errors: string[] = []
  for (const id of Object.values(userIds)) {
    try {
      const { docs } = await payload.find({ collection: 'admin-otps', where: { user: { equals: id } }, limit: 100, overrideAccess: true })
      for (const d of docs) await payload.delete({ collection: 'admin-otps', id: d.id, overrideAccess: true })
      await payload.delete({ collection: 'users', id, overrideAccess: true })
    } catch (err) {
      errors.push(`user ${id}: ${err instanceof Error ? err.message : String(err)}`)
    }
  }
  if (errors.length > 0) throw new Error(`테스트 데이터 정리 실패:\n${errors.join('\n')}`)
})

describe('관리자 로그인·확인 화면', () => {
  it('/manage/login 은 누구나 열 수 있다', async () => {
    const res = await api('/manage/login')
    expect(res.status).toBe(200)
    expect(await res.text()).toContain('관리자 로그인')
  })

  it('/manage/verify 는 비로그인·고객에게 404 다', async () => {
    expect((await api('/manage/verify')).status).toBe(404)
    expect((await api('/manage/verify', { headers: auth(tokens.customer) })).status).toBe(404)
  })

  it('/manage/verify 는 2단계 인증 전 관리자에게 코드 입력 화면을 보여준다', async () => {
    const res = await api('/manage/verify', { headers: auth(tokens.manager) })
    expect(res.status).toBe(200)
    expect(await res.text()).toContain('2단계 인증')
  })

  it('2단계 인증 전 관리자가 /manage 에 가면 /manage/verify 로 보낸다', async () => {
    const res = await api('/manage', { headers: auth(tokens.manager), redirect: 'manual' })
    expect([303, 307, 308]).toContain(res.status)
    expect(res.headers.get('location')).toContain('/manage/verify')
  })
})

describe('POST /api/admin/otp/issue', () => {
  it('비로그인 401, 고객 403 이고 코드가 만들어지지 않는다', async () => {
    expect((await issue()).status).toBe(401)
    expect((await issue(tokens.customer)).status).toBe(403)
    expect(await otpRows(userIds.customer!)).toHaveLength(0)
  })

  it('관리자는 발급받는다 — 코드는 해시로만 저장되고 응답에 실리지 않는다', async () => {
    const res = await issue(tokens.manager)
    expect(res.status).toBe(200)
    const text = await res.text()
    expect(text).not.toMatch(/\d{6}/)
    const rows = await otpRows(userIds.manager!)
    expect(rows.length).toBeGreaterThan(0)
    expect(rows[0]!.hash).toMatch(/^[0-9a-f]{64}$/)
    expect(rows[0]!.consumedAt ?? null).toBeNull()
  })

  it('1시간에 5번을 넘기면 429 다 — 재발송으로 전수 대입하지 못하게', async () => {
    for (let i = 0; i < 5; i++) expect((await issue(tokens.limited)).status).toBe(200)
    const res = await issue(tokens.limited)
    expect(res.status).toBe(429)
    expect(await res.json()).toEqual({ error: 'otp_rate_limited' })
    expect(await otpRows(userIds.limited!)).toHaveLength(5)
  })
})

describe('POST /api/admin/otp/verify', () => {
  it('비로그인 401, 고객 403', async () => {
    expect((await verify('123456')).status).toBe(401)
    expect((await verify('123456', tokens.customer)).status).toBe(403)
  })

  it('형식이 틀리거나 틀린 코드는 400 invalid_code 이고 관리자 화면은 여전히 막혀 있다', async () => {
    await plantCode(userIds.manager!, '424242')
    expect((await verify('abc', tokens.manager)).status).toBe(400)
    const wrong = await verify('000000', tokens.manager)
    expect(wrong.status).toBe(400)
    expect(await wrong.json()).toEqual({ error: 'invalid_code' })
    const page = await api('/manage', { headers: auth(tokens.manager), redirect: 'manual' })
    expect(page.status).not.toBe(200)
  })

  it('맞는 코드를 넣으면 관리자 화면이 열리고, 같은 코드는 다시 쓸 수 없다', async () => {
    await plantCode(userIds.manager!, '135790')
    const ok = await verify('135790', tokens.manager)
    expect(ok.status).toBe(200)
    expect((await api('/manage', { headers: auth(tokens.manager) })).status).toBe(200)
    expect((await verify('135790', tokens.manager)).status).toBe(400)
  })
})
