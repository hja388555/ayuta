// 마이페이지 계정 화면(Figma v2 09-D·09-E·09-F, 큐 Q34)을 실제 서버·DB 앞에서 고정한다.
// 새 비밀번호 규칙이 서버에서 강제되는지, 사업자등록번호가 저장·삭제되는지, 비로그인 접근이 로그인으로 가는지를 본다.
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { api, login } from './helpers/server.js'
import { localPayload } from './helpers/localApi.js'

const RUN = Date.now()
const PW = 'Ayuta!Test-2026'
const email = `acct+${RUN}@ayuta.test`
let userId: number
let token: string

const post = (path: string, body: unknown) => api(path, { method: 'POST', headers: { Authorization: `JWT ${token}` }, body: JSON.stringify(body) })
const profile = { name: '계정테스트', phone: '010-1234-5678', postalCode: '12345', address1: '서울시 동대문구' }

beforeAll(async () => {
  const payload = await localPayload()
  const u = await payload.create({ collection: 'users', overrideAccess: true, data: { email, password: PW, ...profile, role: 'customer' } as never })
  userId = u.id as number
  const r = await login(email, PW)
  expect(r.status).toBe(200)
  token = r.token as string
})

afterAll(async () => {
  const payload = await localPayload()
  await payload.delete({ collection: 'users', id: userId, overrideAccess: true }).catch(() => {})
})

describe('비밀번호 변경 규칙(Q34)', () => {
  it.each([
    ['too_short', 'Ab1!short'],
    ['needs_letter', '1234567890!'],
    ['needs_number', 'abcdefghij!'],
    ['needs_symbol', 'abcdefghij1'],
  ])('%s 이면 400 weak_password', async (_, newPassword) => {
    const res = await post('/api/me/password', { currentPassword: PW, newPassword })
    expect(res.status).toBe(400)
    expect((await res.json()).error).toBe('weak_password')
  })

  it('규칙 위반은 현재 비밀번호 확인 전에 거절돼 기존 비밀번호로 계속 로그인된다', async () => {
    expect((await login(email, PW)).status).toBe(200)
  })
})

describe('비밀번호 변경 — 같은 비밀번호', () => {
  it('새 비밀번호가 현재와 같으면 400 same_password 이고 기존 비밀번호로 계속 로그인된다', async () => {
    const res = await post('/api/me/password', { currentPassword: PW, newPassword: PW })
    expect(res.status).toBe(400)
    expect((await res.json()).error).toBe('same_password')
    expect((await login(email, PW)).status).toBe(200)
  })
})

describe('회원정보 수정 — 연락처 형식', () => {
  it.each(['abc', '010-abcd-5678', '12345'])('%s 이면 400 invalid_phone 이고 저장되지 않는다', async (phone) => {
    const payload = await localPayload()
    const res = await post('/api/me/profile', { ...profile, phone })
    expect(res.status).toBe(400)
    expect((await res.json()).error).toBe('invalid_phone')
    expect((await payload.findByID({ collection: 'users', id: userId, overrideAccess: true })).phone).toBe(profile.phone)
  })
})

describe('주문 상세 — 보는 언어로 표시', () => {
  it('한국어로 저장된 1번 주문을 /ja 에서 열면 라벨·플랫폼 값이 일본어다', async () => {
    const payload = await localPayload()
    const o = await payload.create({
      collection: 'orders',
      overrideAccess: true,
      data: {
        orderNumber: `AY-ACCT-${RUN}`,
        paymentId: `pay-acct-${RUN}`,
        status: 'paid',
        currency: 'KRW',
        amount: 100_000,
        locale: 'ko',
        category: 1,
        customer: userId,
        items: [{ code: 'standard', label: '스탠다드', unitAmount: 100_000, quantity: 1 }],
        contractItems: [
          { label: '등급', value: '스탠다드' },
          { label: '플랫폼', value: '인스타그램, 유튜브, 틱톡, LINE' },
        ],
        orderer: { name: '주문자', phone: profile.phone, email, postcode: '12345', address1: '서울' },
        signature: '주문자',
        contractText: '테스트용 계약서 전문',
      } as never,
    })
    try {
      const ja = await (await api(`/ja/mypage/orders/${o.orderNumber}`, { headers: { Authorization: `JWT ${token}` } })).text()
      expect(ja).toContain('グレード')
      expect(ja).toContain('プラットフォーム')
      expect(ja).toContain('Instagram, YouTube, TikTok, LINE')
      expect(ja).not.toContain('인스타그램')
      expect(ja).not.toContain('>등급<')
      // 한국어 화면은 저장된 그대로
      const ko = await (await api(`/ko/mypage/orders/${o.orderNumber}`, { headers: { Authorization: `JWT ${token}` } })).text()
      expect(ko).toContain('인스타그램, 유튜브, 틱톡, LINE')
      expect(ko).toContain('>등급<')
    } finally {
      await payload.delete({ collection: 'orders', id: o.id, overrideAccess: true }).catch(() => {})
    }
  })
})

describe('회원정보 수정 — 사업자등록번호', () => {
  it('저장하고, 비우면 지운다', async () => {
    const payload = await localPayload()
    expect((await post('/api/me/profile', { ...profile, businessNo: '123-45-67890' })).status).toBe(200)
    expect((await payload.findByID({ collection: 'users', id: userId, overrideAccess: true })).businessNo).toBe('123-45-67890')
    expect((await post('/api/me/profile', { ...profile, businessNo: '' })).status).toBe(200)
    expect((await payload.findByID({ collection: 'users', id: userId, overrideAccess: true })).businessNo ?? null).toBeNull()
  })

  it('너무 긴 값은 400', async () => {
    expect((await post('/api/me/profile', { ...profile, businessNo: 'x'.repeat(21) })).status).toBe(400)
  })
})

describe('계정 화면 접근', () => {
  it.each(['profile', 'password', 'withdraw'])('비로그인으로 /ko/mypage/%s 에 오면 로그인으로 보낸다', async (page) => {
    const res = await api(`/ko/mypage/${page}`, { redirect: 'manual' })
    expect([303, 307, 308]).toContain(res.status)
    expect(res.headers.get('location')).toContain(`/ko/login?next=${encodeURIComponent(`/ko/mypage/${page}`)}`)
  })

  it('로그인하면 열린다', async () => {
    const res = await api('/ko/mypage/profile', { headers: { Authorization: `JWT ${token}` } })
    expect(res.status).toBe(200)
  })
})
