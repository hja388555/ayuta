import 'server-only'
import { headers } from 'next/headers'
import { getPayload } from 'payload'
import config from '@payload-config'
import { isAdminRole, isSuperRole, type Role } from './roles'

export type SessionUser = { id: number; email: string; role: Role }

/**
 * 인증 실패의 원인을 구분한다.
 * 호출자가 예상된 인증 실패와 진짜 에러(데이터베이스 중단 등)를 구별하려면
 * 이 클래스의 instanceof를 검사한다.
 * 예상 밖의 에러(네트워크 끊김, DB 중단)는 그대로 전파돼 로그에 도달한다.
 */
export class AuthError extends Error {
  constructor(public code: 'UNAUTHENTICATED' | 'FORBIDDEN') {
    super(code)
  }
}

/** 로그인한 사용자를 돌려준다. 없으면 null */
export async function getSessionUser(): Promise<SessionUser | null> {
  const payload = await getPayload({ config })
  const { user } = await payload.auth({ headers: await headers() })
  if (!user) return null
  // 소프트 삭제(탈퇴)된 계정은 세션이 살아 있어도 없는 것으로 취급한다.
  // Payload의 로그인 경로는 deletedAt을 모르므로, 여기서 막지 않으면 탈퇴한
  // 관리자까지 모든 게이트를 그대로 통과한다 — 필드만 있고 강제는 어디에도 없는 상태가 된다.
  // 모든 게이트(requireUser/requireAdmin/requireSuper)가 이 함수를 거치므로 여기 한 곳에서 막으면 전부 닫힌다.
  if (user.deletedAt) return null
  return { id: user.id as number, email: user.email as string, role: user.role as Role }
}

export async function requireUser(): Promise<SessionUser> {
  const user = await getSessionUser()
  if (!user) throw new AuthError('UNAUTHENTICATED')
  return user
}

/**
 * 관리자 화면·API 진입점에서 부른다.
 * 관리자 로그인은 이메일·비밀번호만 쓴다 — 2단계 인증은 요청 범위가 아니라 두지 않는다
 * (2026-09-11 사용자 결정). 비밀번호 5회 실패 시 10분 잠금(Users auth)이 남는 방어선이다.
 */
export async function requireAdmin(): Promise<SessionUser> {
  const user = await requireUser()
  if (!isAdminRole(user.role)) throw new AuthError('FORBIDDEN')
  return user
}

/** 환불 승인 · 단가 수정 · 설정에서 부른다 */
export async function requireSuper(): Promise<SessionUser> {
  const user = await requireUser()
  if (!isSuperRole(user.role)) throw new AuthError('FORBIDDEN')
  return user
}
