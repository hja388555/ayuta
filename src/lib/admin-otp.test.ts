import { describe, expect, it } from 'vitest'
import { generateOtp, hashOtp, newSalt, verifyOtp } from './admin-otp'

describe('관리자 6자리 코드', () => {
  it('여섯 자리 숫자를 만든다', () => {
    for (let i = 0; i < 200; i++) expect(generateOtp()).toMatch(/^\d{6}$/)
  })

  it('같은 코드를 두 번 만들지 않는다 (200회 중 중복이 절반 미만)', () => {
    const set = new Set(Array.from({ length: 200 }, () => generateOtp()))
    expect(set.size).toBeGreaterThan(100)
  })

  it('코드를 평문으로 저장하지 않기 위해 해시를 만든다', () => {
    const salt = newSalt()
    const hash = hashOtp('123456', salt)
    expect(hash).not.toContain('123456')
    expect(hash).toHaveLength(64)
  })

  it('salt가 다르면 같은 코드도 다른 해시가 된다', () => {
    expect(hashOtp('123456', newSalt())).not.toBe(hashOtp('123456', newSalt()))
  })

  it('맞는 코드를 통과시킨다', () => {
    const salt = newSalt()
    const hash = hashOtp('123456', salt)
    const now = new Date('2026-09-09T10:00:00Z')
    const exp = new Date('2026-09-09T10:05:00Z')
    expect(verifyOtp('123456', hash, salt, exp, now)).toBe('ok')
  })

  it('틀린 코드를 거부한다', () => {
    const salt = newSalt()
    const hash = hashOtp('123456', salt)
    const now = new Date('2026-09-09T10:00:00Z')
    const exp = new Date('2026-09-09T10:05:00Z')
    expect(verifyOtp('000000', hash, salt, exp, now)).toBe('mismatch')
  })

  it('만료된 코드를 거부한다', () => {
    const salt = newSalt()
    const hash = hashOtp('123456', salt)
    const now = new Date('2026-09-09T10:06:00Z')
    const exp = new Date('2026-09-09T10:05:00Z')
    expect(verifyOtp('123456', hash, salt, exp, now)).toBe('expired')
  })

  it('만료 검사를 코드 비교보다 먼저 한다', () => {
    const salt = newSalt()
    const hash = hashOtp('123456', salt)
    const now = new Date('2026-09-09T11:00:00Z')
    const exp = new Date('2026-09-09T10:05:00Z')
    expect(verifyOtp('000000', hash, salt, exp, now)).toBe('expired')
  })

  it('만료 경계 순간에 맞는 코드는 아직 유효하다', () => {
    // now === expiresAt일 때 > 비교가 거짓이므로 유효 기한 내로 취급
    const salt = newSalt()
    const hash = hashOtp('123456', salt)
    const boundary = new Date('2026-09-09T10:05:00Z')
    expect(verifyOtp('123456', hash, salt, boundary, boundary)).toBe('ok')
  })
})
