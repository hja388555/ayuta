export const ROLES = ['customer', 'manager', 'super'] as const
export type Role = (typeof ROLES)[number]

/** 문자열이 정확히 정의된 role인지 확인한다. 대소문자·공백을 허용하지 않는다 */
const asRole = (value: unknown): Role | null =>
  typeof value === 'string' && (ROLES as readonly string[]).includes(value) ? (value as Role) : null

/** 관리자 화면에 들어갈 수 있는 권한 */
export const isAdminRole = (role: unknown): boolean => {
  const r = asRole(role)
  return r === 'manager' || r === 'super'
}

/** 환불 승인 · 단가 수정 · 설정 권한 */
export const isSuperRole = (role: unknown): boolean => asRole(role) === 'super'

/** 다른 사용자의 role을 바꿀 수 있는 권한 */
export const canManageRoles = (actor: unknown): boolean => isSuperRole(actor)
