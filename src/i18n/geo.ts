import { routing, type Locale } from './routing'

/**
 * 로케일 프리픽스가 없는 주소로 들어온 방문자의 언어를 접속 국가(IP)로 정한다.
 * 국가는 Vercel 이 넣어 주는 `x-vercel-ip-country` 헤더(ISO 3166-1 alpha-2)다.
 * 일본에서 접속하면 일본어, 그 밖(헤더 없음 포함)은 기본 로케일(한국어).
 */
export function localeFromCountry(country: string | null | undefined): Locale {
  return country?.trim().toUpperCase() === 'JP' ? 'ja' : routing.defaultLocale
}

/** 경로가 이미 `/ko`·`/ja` 로 시작하면 그 로케일, 아니면 null */
export function localeFromPath(pathname: string): Locale | null {
  return routing.locales.find((l) => pathname === `/${l}` || pathname.startsWith(`/${l}/`)) ?? null
}
