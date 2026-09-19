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

/**
 * PC(768px 이상)에서 헤더를 숨길 경로(2026-09-15 사용자 결정 — PC 헤더는 메인에만).
 * 메인에서 서비스를 선택해 들어간 주문 흐름(1~5번 주문·결제)과 견적 확인 화면은 PC 에서 헤더를 숨긴다.
 * 모바일 표시는 isHeaderHidden 규칙 그대로다.
 */
export function isPcHeaderHidden(pathname: string): boolean {
  return /^\/(ko|ja)\/(order|quote)(\/|$)/.test(pathname)
}

/**
 * 로그인·가입 화면에서 헤더의 같은 버튼을 숨길지 판정(2026-09-18 클라이언트 지적 — "로그인 두개").
 * 지금 보고 있는 화면으로 다시 보내는 버튼만 숨기고 반대쪽 버튼은 남긴다 — 헤더에서 두 화면을
 * 오가는 길이 끊기지 않게.
 */
export function isOwnAuthPage(pathname: string, page: 'login' | 'signup'): boolean {
  return new RegExp(`^/(ko|ja)/${page}/?$`).test(pathname)
}

/**
 * 헤더 회원가입 버튼을 숨길지 판정(2026-09-19 클라이언트 요청 — 한 화면에 같은 기능 버튼 하나).
 * /signup 화면은 기존 isOwnAuthPage 규칙 그대로 숨기고, 채팅 화면은 본문의
 * 「30초 회원가입하고 상담하기」를 남기기로 클라이언트가 지정했으므로 헤더 쪽을 숨긴다.
 */
export function hideHeaderSignup(pathname: string): boolean {
  return isOwnAuthPage(pathname, 'signup') || /^\/(ko|ja)\/chat(\/|$)/.test(pathname)
}
