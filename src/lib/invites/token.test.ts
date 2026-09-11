import { describe, expect, it } from 'vitest'
import { INVITE_TTL_MS, generateInviteToken, hashInviteToken, inviteExpiresAt, isInviteUsable, isWellFormedToken } from './token'

describe('초대 토큰', () => {
  it('base64url 43자, 매번 다르다', () => {
    const a = generateInviteToken()
    expect(isWellFormedToken(a)).toBe(true)
    expect(a).not.toBe(generateInviteToken())
  })

  it('해시는 sha256 hex 로 결정적이고 원본과 다르다', () => {
    const t = generateInviteToken()
    expect(hashInviteToken(t)).toMatch(/^[0-9a-f]{64}$/)
    expect(hashInviteToken(t)).toBe(hashInviteToken(t))
    expect(hashInviteToken(t)).not.toContain(t)
  })

  it('형식이 틀린 토큰은 거른다', () => {
    for (const bad of ['', 'abc', 'x'.repeat(44), `${'a'.repeat(42)}=`, null, 1]) expect(isWellFormedToken(bad)).toBe(false)
  })

  it('만료는 72시간 뒤, 사용·만료된 초대는 못 쓴다', () => {
    const now = new Date('2026-09-11T00:00:00Z')
    const exp = inviteExpiresAt(now)
    expect(exp.getTime() - now.getTime()).toBe(INVITE_TTL_MS)
    expect(isInviteUsable({ expiresAt: exp.toISOString() }, now)).toBe(true)
    expect(isInviteUsable({ expiresAt: exp.toISOString(), usedAt: now.toISOString() }, now)).toBe(false)
    expect(isInviteUsable({ expiresAt: exp.toISOString() }, new Date(exp.getTime() + 1))).toBe(false)
  })
})
