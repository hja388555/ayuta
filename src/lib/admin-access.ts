import type { PayloadRequest } from 'payload'
import { isAdminRole, isSuperRole } from './roles'

/**
 * 컬렉션 access 용 관리자 판정: 관리자 role 이고 탈퇴(deletedAt)하지 않은 계정.
 *
 * 화면·전용 API 게이트(dal.ts requireAdmin)와 같은 판정을 컬렉션 access(REST·GraphQL)에도
 * 쓰도록 한 곳에 둔다 — 둘이 갈라지면 한쪽이 우회로가 된다. 탈퇴 확인을 여기서도 하는 이유:
 * Payload 의 세션 판정은 deletedAt 을 모르므로, 빠뜨리면 탈퇴한 관리자 세션이 REST 로 고객
 * 개인정보를 읽는다(dal.ts getSessionUser 주석과 같은 판단).
 * `server-only` 를 붙이지 않는다: 컬렉션 설정이 import 한다.
 */
export function isActiveAdmin(req: PayloadRequest): boolean {
  const user = req.user as { role?: unknown; deletedAt?: unknown } | null | undefined
  return Boolean(user && isAdminRole(user.role) && !user.deletedAt)
}

export function isActiveSuper(req: PayloadRequest): boolean {
  return isSuperRole(req.user?.role) && isActiveAdmin(req)
}
