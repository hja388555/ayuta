/**
 * 비밀번호 규칙(2026-09-16 사용자 결정 — 가입 규칙이 너무 빡세다).
 * 8자 이상이면 된다. 문자 종류 조합은 요구하지 않는다.
 * 기존 회원 비밀번호에는 소급하지 않는다 — 가입·변경 때만 검사한다.
 */
export const PASSWORD_MIN = 8
export const PASSWORD_MAX = 128

export type PasswordIssue = 'too_short' | 'too_long' | 'needs_letter' | 'needs_number' | 'needs_symbol'

export function passwordIssue(pw: string): PasswordIssue | null {
  if (pw.length < PASSWORD_MIN) return 'too_short'
  if (pw.length > PASSWORD_MAX) return 'too_long'
  return null
}
