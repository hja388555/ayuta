import { isAdminRole } from './roles'

/**
 * "로그인 상태 유지" 세션 길이 규칙. 기본은 Users.auth.tokenExpiration(2시간)과 같다.
 * 고객이 체크하면 30일, 관리자(manager·super)는 체크해도 12시간까지만 — 관리자 계정이 오래 열려 있는
 * 공용·분실 기기가 가장 큰 위험이라서다.
 */
export const DEFAULT_SESSION_SECONDS = 2 * 60 * 60
export const KEEP_SESSION_SECONDS = 30 * 24 * 60 * 60
export const ADMIN_KEEP_SESSION_SECONDS = 12 * 60 * 60

export type LoginSessionPlan = {
  /** JWT exp 와 users.sessions[].expiresAt 에 쓸 길이(초) */
  seconds: number
  /** 쿠키 Max-Age. undefined 면 브라우저를 닫으면 사라지는 세션 쿠키 */
  cookieMaxAge: number | undefined
}

export function loginSessionPlan({ role, keep }: { role: unknown; keep: boolean }): LoginSessionPlan {
  if (!keep) return { seconds: DEFAULT_SESSION_SECONDS, cookieMaxAge: undefined }
  const seconds = isAdminRole(role) ? ADMIN_KEEP_SESSION_SECONDS : KEEP_SESSION_SECONDS
  return { seconds, cookieMaxAge: seconds }
}

type SessionRow = { id?: unknown; expiresAt?: unknown }

/**
 * 만료 시각이 지난 세션을 뺀다. Payload 3.88 의 JWT 전략(auth/strategies/jwt.js)은 토큰의 sid 와 같은
 * 세션이 "있는지"만 보고 expiresAt 은 보지 않는다. Users afterRead 훅이 이걸로 걸러, 만료된 세션의
 * 토큰은 JWT exp 가 남아 있어도 인증되지 않게 한다.
 */
export function activeSessions<T extends SessionRow>(sessions: T[], now: Date = new Date()): T[] {
  return sessions.filter((s) => {
    const at = s.expiresAt instanceof Date ? s.expiresAt : new Date(String(s.expiresAt))
    return !Number.isNaN(at.getTime()) && at > now
  })
}
