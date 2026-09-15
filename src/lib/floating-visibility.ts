/** PC 우측 세로 메뉴는 메인(/ko · /ja)에만 둔다 — 모바일 탭바와 같은 규칙 (2026-09-15) */
export function isFloatingVisible(pathname: string): boolean {
  return /^\/(ko|ja)\/?$/.test(pathname)
}
