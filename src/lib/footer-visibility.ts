/**
 * 사업자정보 푸터를 숨길 경로 판정. 푸터는 메인(/ko · /ja)에만 두고 나머지 화면은 모두 숨긴다
 * (2026-09-15 결정 — 사이트 첫 화면에 한 번 표시). locale 세그먼트(ko/ja)는 pathname 에 그대로 들어있다.
 */
export function isFooterHidden(pathname: string): boolean {
  return !/^\/(ko|ja)\/?$/.test(pathname)
}
