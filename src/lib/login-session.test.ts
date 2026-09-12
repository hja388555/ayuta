import { describe, expect, it } from 'vitest'
import { activeSessions, ADMIN_KEEP_SESSION_SECONDS, DEFAULT_SESSION_SECONDS, KEEP_SESSION_SECONDS, loginSessionPlan } from './login-session'

describe('loginSessionPlan', () => {
  it('상수', () => {
    expect(DEFAULT_SESSION_SECONDS).toBe(7200)
    expect(KEEP_SESSION_SECONDS).toBe(2592000)
    expect(ADMIN_KEEP_SESSION_SECONDS).toBe(43200)
  })

  it.each(['customer', 'manager', 'super', undefined, 'SUPER'])('유지 안 함(%s) → 2시간·세션 쿠키', (role) =>
    expect(loginSessionPlan({ role, keep: false })).toEqual({ seconds: 7200, cookieMaxAge: undefined }),
  )

  it('고객 유지 → 30일', () => expect(loginSessionPlan({ role: 'customer', keep: true })).toEqual({ seconds: 2592000, cookieMaxAge: 2592000 }))

  it.each(['manager', 'super'])('관리자(%s) 유지 → 12시간 상한', (role) =>
    expect(loginSessionPlan({ role, keep: true })).toEqual({ seconds: 43200, cookieMaxAge: 43200 }),
  )

  it('알 수 없는 role 은 관리자로 올려 주지 않는다(고객 규칙)', () => expect(loginSessionPlan({ role: 'Super', keep: true }).seconds).toBe(2592000))
})

describe('activeSessions', () => {
  const now = new Date('2026-09-12T00:00:00Z')
  it('지난 것·같은 시각·잘못된 값은 뺀다', () => {
    const rows = [
      { id: 'past', expiresAt: '2026-09-11T23:59:59Z' },
      { id: 'same', expiresAt: now },
      { id: 'future', expiresAt: new Date('2026-09-12T00:00:01Z') },
      { id: 'future-str', expiresAt: '2026-10-01T00:00:00Z' },
      { id: 'bad', expiresAt: 'nope' },
      { id: 'missing' },
    ]
    expect(activeSessions(rows, now).map((r) => r.id)).toEqual(['future', 'future-str'])
  })
})
