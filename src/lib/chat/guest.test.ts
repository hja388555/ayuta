import { describe, expect, it } from 'vitest'
import {
  clientIp,
  creationWindowStart,
  generateGuestToken,
  guestCookieOptions,
  GuestStartSchema,
  hashClientIp,
  hashGuestToken,
  hasThreadOwner,
  isCreationLimited,
  isGuestTokenShape,
} from './guest'

describe('비회원 토큰', () => {
  it('256bit base64url 43자, 매번 다르다', () => {
    const a = generateGuestToken()
    expect(a).toMatch(/^[A-Za-z0-9_-]{43}$/)
    expect(generateGuestToken()).not.toBe(a)
    expect(isGuestTokenShape(a)).toBe(true)
  })
  it('해시는 SHA-256 hex, 같은 토큰은 같은 해시', () => {
    const t = generateGuestToken()
    expect(hashGuestToken(t)).toMatch(/^[0-9a-f]{64}$/)
    expect(hashGuestToken(t)).toBe(hashGuestToken(t))
    expect(hashGuestToken(t)).not.toBe(t)
  })
  it('모양이 틀리면 거른다', () => {
    for (const v of ['', 'short', 'a'.repeat(42), 'a'.repeat(44), `${'a'.repeat(42)}.`, 123, null]) expect(isGuestTokenShape(v)).toBe(false)
  })
  it('쿠키는 httpOnly·Lax, 운영에서만 Secure', () => {
    expect(guestCookieOptions(true)).toMatchObject({ httpOnly: true, secure: true, sameSite: 'lax', path: '/' })
    expect(guestCookieOptions(false).secure).toBe(false)
  })
})

describe('시작 폼 검증', () => {
  const ok = { name: ' 홍길동 ', email: 'a@b.co', phone: '010-1234-5678', consent: true, locale: 'ko' }
  it('정상 입력은 앞뒤 공백을 잘라 통과', () => {
    const r = GuestStartSchema.safeParse(ok)
    expect(r.success && r.data.name).toBe('홍길동')
  })
  it('동의 없음·이메일 형식·연락처·빈 이름·모르는 칸은 거절', () => {
    for (const bad of [
      { ...ok, consent: false },
      { ...ok, consent: 'on' },
      { ...ok, email: 'nope' },
      { ...ok, phone: '12' },
      { ...ok, phone: '010-abcd-5678' },
      { ...ok, name: '  ' },
      { ...ok, locale: 'en' },
      { ...ok, extra: 1 },
    ]) {
      expect(GuestStartSchema.safeParse(bad).success).toBe(false)
    }
  })
})

describe('생성 제한', () => {
  it('x-real-ip 우선, 없으면 x-forwarded-for 첫 값', () => {
    const h = (m: Record<string, string>) => (n: string) => m[n] ?? null
    expect(clientIp(h({ 'x-real-ip': '1.1.1.1', 'x-forwarded-for': '2.2.2.2' }))).toBe('1.1.1.1')
    expect(clientIp(h({ 'x-forwarded-for': ' 2.2.2.2 , 3.3.3.3' }))).toBe('2.2.2.2')
    expect(clientIp(h({}))).toBe('unknown')
  })
  it('IP 해시는 비밀값에 따라 달라지고 원문을 담지 않는다', () => {
    expect(hashClientIp('1.1.1.1', 's1')).not.toBe(hashClientIp('1.1.1.1', 's2'))
    expect(hashClientIp('1.1.1.1', 's1')).not.toContain('1.1.1.1')
  })
  it('한 시간 5개까지', () => {
    expect(isCreationLimited(4)).toBe(false)
    expect(isCreationLimited(5)).toBe(true)
    expect(creationWindowStart(new Date('2026-09-12T01:00:00Z')).toISOString()).toBe('2026-09-12T00:00:00.000Z')
  })
})

describe('방 주인', () => {
  it('회원 또는 비회원 이름·이메일이 있어야 한다', () => {
    expect(hasThreadOwner({ customer: 3 })).toBe(true)
    expect(hasThreadOwner({ guestName: '홍', guestEmail: 'a@b.co' })).toBe(true)
    expect(hasThreadOwner({ guestName: '홍' })).toBe(false)
    expect(hasThreadOwner({ customer: null, guestName: ' ', guestEmail: 'a@b.co' })).toBe(false)
    expect(hasThreadOwner({})).toBe(false)
  })
  it('부분 수정은 원래 문서와 합쳐 본다', () => {
    expect(hasThreadOwner({ unreadForAdmin: 0 } as never, { guestName: '홍', guestEmail: 'a@b.co' })).toBe(true)
    expect(hasThreadOwner({ customer: null }, { customer: 3 })).toBe(false)
  })
})
