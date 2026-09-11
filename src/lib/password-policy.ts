/**
 * 비밀번호 규칙(큐 Q34, Figma v2 가입·비밀번호 변경 — 2026-09-11 사용자 결정 "시안대로").
 * 영문·숫자·기호를 모두 넣어 10자 이상. 기존 회원 비밀번호에는 소급하지 않는다 — 가입·변경 때만 검사한다.
 */
export const PASSWORD_MIN = 10
export const PASSWORD_MAX = 128

export type PasswordIssue = 'too_short' | 'too_long' | 'needs_letter' | 'needs_number' | 'needs_symbol'

export function passwordIssue(pw: string): PasswordIssue | null {
  if (pw.length < PASSWORD_MIN) return 'too_short'
  if (pw.length > PASSWORD_MAX) return 'too_long'
  if (!/[A-Za-z]/.test(pw)) return 'needs_letter'
  if (!/[0-9]/.test(pw)) return 'needs_number'
  if (!/[^A-Za-z0-9]/.test(pw)) return 'needs_symbol'
  return null
}
