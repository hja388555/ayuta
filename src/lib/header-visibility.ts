/**
 * 사이트 헤더(언어 전환·로그인·회원가입)를 숨길 경로 판정(2026-09-14 6라운드).
 * 1~4번 주문 화면(digital-sns·local-video·press-blog·transit)에서만 숨기고, 그 안의 결제
 * 화면(checkout)과 5번(other)·메인·마이페이지 등 나머지는 그대로 보여준다.
 */
const NO_HEADER_SLUGS = ['digital-sns', 'local-video', 'press-blog', 'transit'] as const

export function isHeaderHidden(pathname: string): boolean {
  const m = /^\/(ko|ja)\/order\/([^/]+)(\/(.*))?$/.exec(pathname)
  if (!m) return false
  const [, , slug, , rest] = m
  if (!NO_HEADER_SLUGS.includes(slug as (typeof NO_HEADER_SLUGS)[number])) return false
  // 같은 카테고리라도 checkout(결제) 화면은 헤더를 유지한다
  return !rest?.startsWith('checkout')
}
