/**
 * 사업자정보 푸터를 숨길 경로 판정(2026-09-14 5라운드). 결제 화면(주문 결제·견적 결제)에서만
 * 숨기고 나머지 화면은 그대로 보여준다. locale 세그먼트(ko/ja)는 pathname 에 그대로 들어있다.
 */
export function isFooterHidden(pathname: string): boolean {
  return /^\/(ko|ja)\/order\/[^/]+\/checkout(\/|$)/.test(pathname) || /^\/(ko|ja)\/quote\/[^/]+(\/|$)/.test(pathname)
}
