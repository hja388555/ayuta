// 통합 로그인(요구사항 1-16)·회원가입·마이페이지·비회원 조회(큐 Q21)·탈퇴(Q20-C)를 실제
// 서버·DB 앞에서 고정한다. role 이 클라이언트에서 올라가지 않는지, 탈퇴가 주문 기록을 지우지
// 않는지, 비회원 조회가 세 값 모두를 요구하는지를 본다.
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { api, login } from './helpers/server.js'
import { localPayload } from './helpers/localApi.js'

const RUN = Date.now()
const PW = 'Ayuta!Test-2026'
const base = { name: '홍길동', phone: '010-0000-0000', postalCode: '00000', address1: '서울시' }
const signupBody = (email: string, over: Record<string, unknown> = {}) => ({
  email,
  password: PW,
  name: '가입자',
  phone: '010-7777-0000',
  postalCode: '12345',
  address1: '서울시 동대문구',
  agreeTerms: true,
  agreePrivacy: true,
  ...over,
})

const userIds: number[] = []
const orderIds: number[] = []
const auth = (token?: string): Record<string, string> => (token ? { Authorization: `JWT ${token}` } : {})
const post = (path: string, body: unknown, token?: string) => api(path, { method: 'POST', headers: auth(token), body: JSON.stringify(body) })

const makeOrder = async (status: string, customer: number | null, orderer: { email: string; phone: string }) => {
  const payload = await localPayload()
  const o = await payload.create({
    collection: 'orders',
    overrideAccess: true,
    data: {
      orderNumber: `AY-MP-${RUN}-${Math.random().toString(36).slice(2, 8)}`,
      paymentId: `pay-mp-${RUN}-${Math.random().toString(36).slice(2, 8)}`,
      status: status as 'paid',
      currency: 'KRW',
      amount: 100_000,
      locale: 'ko',
      category: 1,
      customer,
      items: [{ code: 'standard', label: '스탠다드', unitAmount: 100_000, quantity: 1 }],
      contractItems: [{ label: '등급', value: '스탠다드' }],
      orderer: { name: '주문자', phone: orderer.phone, email: orderer.email, postcode: '12345', address1: '서울' },
      signature: '주문자',
      contractText: '테스트용 계약서 전문',
    },
  })
  orderIds.push(o.id as number)
  return o
}
const userByEmail = async (email: string) => {
  const payload = await localPayload()
  const { docs } = await payload.find({ collection: 'users', where: { email: { equals: email } }, limit: 1, overrideAccess: true })
  return docs[0]
}

afterAll(async () => {
  const payload = await localPayload()
  for (const id of orderIds) await payload.delete({ collection: 'orders', id, overrideAccess: true }).catch(() => {})
  await payload.db.pool.query('DELETE FROM admin_login_logs WHERE user_id = ANY($1::int[])', [userIds]).catch(() => {})
  for (const id of userIds) await payload.delete({ collection: 'users', id, overrideAccess: true }).catch(() => {})
})

describe('POST /api/signup', () => {
  it('필수 동의가 빠지면 400 consent_required 이고 계정이 생기지 않는다', async () => {
    const email = `mp-noconsent+${RUN}@ayuta.test`
    const res = await post('/api/signup', signupBody(email, { agreePrivacy: false }))
    expect(res.status).toBe(400)
    expect(await res.json()).toEqual({ error: 'consent_required' })
    expect(await userByEmail(email)).toBeUndefined()
  })

  it('role 을 super 로 보내도 customer 로 가입된다 (1-16 규칙 1)', async () => {
    const email = `mp-escalate+${RUN}@ayuta.test`
    const res = await post('/api/signup', signupBody(email, { role: 'super' }))
    expect(res.status).toBe(200)
    const u = await userByEmail(email)
    userIds.push(u!.id as number)
    expect(u!.role).toBe('customer')
    expect(u!.termsAgreedAt).toBeTruthy()
    expect(u!.privacyAgreedAt).toBeTruthy()
  })

  it('짧은 비밀번호는 400 이다', async () => {
    expect((await post('/api/signup', signupBody(`mp-short+${RUN}@ayuta.test`, { password: 'short' }))).status).toBe(400)
  })
})

describe('통합 로그인 · 헤더', () => {
  let adminToken: string | undefined
  let adminId: number

  beforeAll(async () => {
    const payload = await localPayload()
    const a = await payload.create({
      collection: 'users',
      data: { email: `mp-admin+${RUN}@ayuta.test`, password: PW, ...base, role: 'manager' },
      overrideAccess: true,
      context: { allowRoleAssignment: true },
    })
    adminId = a.id as number
    userIds.push(adminId)
    adminToken = (await login(`mp-admin+${RUN}@ayuta.test`, PW)).token
  })

  it('/manage/login 은 통합 로그인으로 보낸다 (별도 관리자 로그인 없음)', async () => {
    const res = await api('/manage/login', { redirect: 'manual' })
    expect([303, 307, 308]).toContain(res.status)
    expect(res.headers.get('location')).toContain('/ko/login')
  })

  it('로그인 화면 하단에 비회원 주문 조회가 있다', async () => {
    const html = await (await api('/ko/login')).text()
    expect(html).toContain('비회원 주문 조회')
  })

  it('관리자 로그인은 시각·IP 가 기록된다 (1-16 규칙 5)', async () => {
    const payload = await localPayload()
    const { totalDocs } = await payload.count({ collection: 'admin-login-logs', where: { user: { equals: adminId } }, overrideAccess: true })
    expect(totalDocs).toBeGreaterThan(0)
  })

  it('관리자에게만 헤더에 [관리자] 버튼이 보인다', async () => {
    const adminHtml = await (await api('/ko', { headers: auth(adminToken) })).text()
    expect(adminHtml).toContain('[관리자]')
    expect(adminHtml).toContain('href="/manage"')
    // 버튼 문구가 아니라 링크 자체가 없어야 한다 — 문구만 숨기고 링크가 남는 회귀를 잡는다
    const guestHtml = await (await api('/ko')).text()
    expect(guestHtml).not.toContain('href="/manage"')
  })
})

describe('마이페이지', () => {
  const email = `mp-member+${RUN}@ayuta.test`
  let token: string | undefined
  let memberId: number
  let otherOrderNumber: string

  beforeAll(async () => {
    await post('/api/signup', signupBody(email))
    const u = await userByEmail(email)
    memberId = u!.id as number
    userIds.push(memberId)
    token = (await login(email, PW)).token
    await makeOrder('done', memberId, { email, phone: '010-7777-0000' })
    const other = await makeOrder('done', null, { email: 'someone@example.com', phone: '010-1111-2222' })
    otherOrderNumber = other.orderNumber as string
  })

  it('비로그인은 로그인 화면으로 보낸다', async () => {
    const res = await api('/ko/mypage', { redirect: 'manual' })
    expect([303, 307, 308]).toContain(res.status)
    expect(res.headers.get('location')).toContain('/ko/login')
  })

  it('내 주문만 보인다', async () => {
    const html = await (await api('/ko/mypage', { headers: auth(token) })).text()
    expect(html).toContain('주문 내역')
    expect(html).not.toContain(otherOrderNumber)
  })

  it('정보 수정: 모르는 필드(role)가 섞이면 통째로 거부하고, 정상 수정은 반영된다', async () => {
    const bad = await post('/api/me/profile', { name: '새이름', phone: '010', postalCode: '1', address1: 'a', role: 'super' }, token)
    expect(bad.status).toBe(400)
    const ok = await post('/api/me/profile', { name: '새이름', phone: '010-3333-4444', postalCode: '54321', address1: '부산시' }, token)
    expect(ok.status).toBe(200)
    const u = await userByEmail(email)
    expect(u!.name).toBe('새이름')
    expect(u!.role).toBe('customer')
  })

  it('비밀번호 변경: 현재 비밀번호가 틀리면 400, 맞으면 새 비밀번호로 로그인된다', async () => {
    expect((await post('/api/me/password', { currentPassword: 'wrong-password', newPassword: 'NewPass!2026' }, token)).status).toBe(400)
    expect((await post('/api/me/password', { currentPassword: PW, newPassword: 'NewPass!2026' }, token)).status).toBe(200)
    expect((await login(email, 'NewPass!2026')).token).toBeTruthy()
    token = (await login(email, 'NewPass!2026')).token
  })

  it('탈퇴: 진행 중 주문이 있으면 409 이다', async () => {
    const active = await makeOrder('in_progress', memberId, { email, phone: '010-7777-0000' })
    const res = await post('/api/me/withdraw', {}, token)
    expect(res.status).toBe(409)
    const payload = await localPayload()
    await payload.update({ collection: 'orders', id: active.id, data: {}, overrideAccess: true })
    await payload.db.pool.query("UPDATE orders SET status = 'done' WHERE id = $1", [active.id])
  })

  it('탈퇴하면 식별정보가 파기되고 다시 로그인할 수 없으며, 주문 기록은 남는다', async () => {
    const res = await post('/api/me/withdraw', {}, token)
    expect(res.status).toBe(200)
    const payload = await localPayload()
    const u = await payload.findByID({ collection: 'users', id: memberId, overrideAccess: true })
    expect(u.deletedAt).toBeTruthy()
    expect(u.email).toBe(`deleted+${memberId}@deleted.invalid`)
    expect(u.name).toBe('탈퇴회원')
    expect((await login(email, 'NewPass!2026')).token).toBeFalsy()
    // 기존 세션도 게이트에서 막힌다(getSessionUser 의 deletedAt 검사)
    const page = await api('/ko/mypage', { headers: auth(token), redirect: 'manual' })
    expect([303, 307, 308]).toContain(page.status)
    const { totalDocs } = await payload.count({ collection: 'orders', where: { customer: { equals: memberId } }, overrideAccess: true })
    expect(totalDocs).toBeGreaterThan(0)
  })
})

describe('POST /api/order-lookup — 비회원 조회', () => {
  const guest = { email: `guest+${RUN}@example.com`, phone: '010-8888-9999' }
  let orderNumber: string

  beforeAll(async () => {
    orderNumber = (await makeOrder('paid', null, guest)).orderNumber as string
  })

  it('세 값이 모두 맞으면 쿠키와 함께 주문 화면 경로를 준다', async () => {
    const res = await post('/api/order-lookup', { orderNumber, ...guest })
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.path).toContain(encodeURIComponent(orderNumber))
    const cookie = res.headers.get('set-cookie') ?? ''
    expect(cookie).toContain('ayuta_guest_proof=')
    expect(cookie.toLowerCase()).toContain('httponly')
    const page = await api(body.path, { headers: { Cookie: cookie.split(';')[0]! } })
    expect(await page.text()).toContain(orderNumber)
  })

  it('하나라도 틀리면 같은 404 로만 답한다', async () => {
    for (const bad of [
      { orderNumber, email: 'wrong@example.com', phone: guest.phone },
      { orderNumber, email: guest.email, phone: '010-0000-0000' },
      { orderNumber: 'AY-NOPE-0000', ...guest },
    ]) {
      const res = await post('/api/order-lookup', bad)
      expect(res.status).toBe(404)
      expect(await res.json()).toEqual({ error: 'not_found' })
    }
  })
})
