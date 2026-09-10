// 표지(cover) 의 나라·목적 선택 — 순수 로직만. DOM·라우터를 모른다.
// docs/카테고리-항목구성.md 00절: 나라는 필수·중복 가능, 목적은 선택.
// 결제 통화는 여기서 정하지 않는다 — 통화는 페이지 언어(locale)만 본다(별도 규칙).

export const COUNTRY_CODES = ['jp', 'kr'] as const
export type CountryCode = (typeof COUNTRY_CODES)[number]

// 계약서 제1조 "광고 국가" 줄은 원문 순서(한국 / 일본)를 그대로 따른다 — 표지 화면의
// 노출 순서(일본 먼저, 2026-09-08 대표님 사진 기준)와는 다른 관심사라 별도로 둔다.
const CONTRACT_COUNTRY_ORDER: readonly CountryCode[] = ['kr', 'jp']

const COUNTRY_LABELS: Record<CountryCode, { ko: string; ja: string }> = {
  kr: { ko: '한국', ja: '韓国' },
  jp: { ko: '일본', ja: '日本' },
}

export const PURPOSE_CODES = ['brand', 'product', 'store', 'medical', 'event', 'etc'] as const
export type PurposeCode = (typeof PURPOSE_CODES)[number]

function isCountryCode(v: string): v is CountryCode {
  return (COUNTRY_CODES as readonly string[]).includes(v)
}

/** 쿼리스트링 등 신뢰할 수 없는 입력에서 유효한 나라 코드만 남긴다. 순서·중복은 호출자 책임 */
export function sanitizeCountries(values: readonly string[]): CountryCode[] {
  return values.filter(isCountryCode)
}

function isPurposeCode(v: string): v is PurposeCode {
  return (PURPOSE_CODES as readonly string[]).includes(v)
}

/** 신뢰할 수 없는 입력에서 유효한 목적 코드만 남긴다. 목적이 선택이라 없거나 알 수 없으면 undefined */
export function sanitizePurpose(value: string | undefined): PurposeCode | undefined {
  return value !== undefined && isPurposeCode(value) ? value : undefined
}

/**
 * 서비스 카드를 클릭해도 되는지. 나라는 필수, 목적은 선택이다(RULES ALREADY SETTLED) —
 * 나라가 비어 있으면 이동을 막고 안내만 보여준다. 목적은 이 판단에 관여하지 않는다.
 */
export function canProceedToService(countries: readonly string[]): boolean {
  return countries.length > 0
}

/**
 * 표지에서 카테고리 화면으로 넘길 쿼리스트링. 금액은 절대 담지 않는다 — 나라·목적 모두
 * 가격에 관여하지 않는 선택이라 애초에 금액이 될 수 없는 값들이다.
 */
export function buildCoverQuery(countries: readonly string[], purpose: string | undefined): string {
  const qs = new URLSearchParams()
  for (const c of sanitizeCountries(countries)) qs.append('country', c)
  if (purpose) qs.set('purpose', purpose)
  return qs.toString()
}

/**
 * 계약서 "광고 국가" 줄에 찍을 문자열. 원본 표기 순서(한국, 일본)로 고정하고,
 * 고객이 고른 나라만 남긴다. 예: 둘 다 고르면 "한국, 일본", 일본만 고르면 "일본".
 */
export function formatCountries(countries: readonly string[], locale: 'ko' | 'ja'): string {
  const chosen = new Set(sanitizeCountries(countries))
  return CONTRACT_COUNTRY_ORDER.filter((c) => chosen.has(c))
    .map((c) => COUNTRY_LABELS[c][locale])
    .join(', ')
}
