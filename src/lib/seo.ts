import { routing } from '@/i18n/routing'

/**
 * 검색 노출 설정의 공통 조각(큐 Q27 — hreflang 상호참조, canonical 자기참조, sitemap alternates).
 *
 * 기준 주소는 NEXT_PUBLIC_SITE_URL 하나로 정한다. 도메인이 아직 없어 로컬 주소가 들어가 있지만,
 * 도메인을 받으면 이 값만 바꾸면 canonical·hreflang·sitemap·robots 가 모두 따라간다.
 * 잘못된 값(프로토콜 없음 등)이면 로컬 주소로 떨어뜨린다 — URL 생성이 던지면 모든 페이지가 500 이다.
 */
export function siteUrl(): URL {
  const raw = process.env.NEXT_PUBLIC_SITE_URL
  try {
    if (raw) return new URL(raw)
  } catch {
    // 아래 기본값으로
  }
  return new URL('http://localhost:3000')
}

/** 로케일이 빠진 경로(예: '', '/order/transit')를 받아 그 페이지의 canonical·hreflang 을 만든다 */
export function localeAlternates(locale: string, path: string) {
  const clean = path === '/' ? '' : path
  const languages: Record<string, string> = {}
  for (const l of routing.locales) languages[l] = `/${l}${clean}`
  // 언어를 정하지 못한 방문자(검색 엔진 포함)에게 보여줄 기본 — 기본 로케일(한국어)
  languages['x-default'] = `/${routing.defaultLocale}${clean}`
  return { canonical: `/${locale}${clean}`, languages }
}

/** 검색 결과에 나오면 안 되는 화면(로그인·마이페이지·결제·견적 링크 등) */
export const NO_INDEX = { index: false, follow: false } as const
