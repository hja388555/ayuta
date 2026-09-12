/**
 * 연락처 규칙(한국·일본). 브라우저·서버 공용이라 의존성이 없다 — 회원가입·회원정보·결제·문의·비회원 채팅이 같이 쓴다.
 *
 * 저장: E.164(+821012345678 · +819012345678). 화면: 국내 표기(010-1234-5678 · 090-1234-5678).
 * 예전에 받은 값('010-1234-5678' 등)은 옮기지 않는다 — 읽을 수 없으면 그대로 보여 주고, 다음 저장 때 정규화된다.
 *
 * 한국(국내 번호, 0 포함 자릿수)
 * - 휴대폰 010 + 8자리(11) · 옛 번호 011·016·017·018·019 (10~11)
 * - 서울 02 (9~10) · 지역번호 031~033·041~044·051~055·061~064 (10~11) · 인터넷전화 070 (11)
 * - 대표번호 15xx·16xx·18xx 8자리(예: 1588-1234) — 법인 고객이 대표번호를 적는 경우가 있어 받는다
 * 일본
 * - 휴대폰·IP 070·080·090 + 8자리(11) · 050 (11)
 * - 유선 0 + 9자리(10, 예: 03-1234-5678). 0X0 으로 시작하는 10자리는 유선이 아니라 받지 않는다
 */
export const PHONE_MAX = 40

export const PHONE_COUNTRIES = ['KR', 'JP'] as const
export type PhoneCountry = (typeof PHONE_COUNTRIES)[number]

const DIAL: Record<PhoneCountry, string> = { KR: '82', JP: '81' }

const KR_RULES = [
  /^010\d{8}$/,
  /^01[16789]\d{7,8}$/,
  /^02\d{7,8}$/,
  /^0(3[1-3]|4[1-4]|5[1-5]|6[1-4])\d{7,8}$/,
  /^070\d{8}$/,
  /^1[568]\d{6}$/,
]
const JP_RULES = [/^0[5789]0\d{8}$/, /^0(?![5789]0)[1-9]\d{8}$/]

export const isPhoneCountry = (v: unknown): v is PhoneCountry => v === 'KR' || v === 'JP'

/** 국내 번호(0 포함, 숫자만)가 그 나라 규칙에 맞는지 */
function validNational(national: string, country: PhoneCountry): boolean {
  return (country === 'KR' ? KR_RULES : JP_RULES).some((re) => re.test(national))
}

/**
 * 입력을 나라와 국내 번호(숫자만, 0 포함)로 나눈다. 하이픈·공백·괄호·점은 무시한다.
 * +82 / 0082 / +81 / 0081 로 시작하면 고른 나라보다 앞 번호가 우선이다. 형식만 보고 규칙은 보지 않는다.
 */
export function splitPhone(raw: string, selected: PhoneCountry): { country: PhoneCountry; national: string } | null {
  const v = raw.trim()
  if (!v || v.length > PHONE_MAX || !/^[\d+\-(). ]+$/.test(v)) return null
  const plus = v.startsWith('+')
  const digits = v.replace(/\D/g, '')
  if (!digits || (plus && v.indexOf('+', 1) !== -1) || (!plus && v.includes('+'))) return null
  const intl = plus ? digits : digits.startsWith('00') ? digits.slice(2) : null
  if (intl === null) return { country: selected, national: digits }
  for (const country of PHONE_COUNTRIES) {
    if (intl.startsWith(DIAL[country])) {
      const rest = intl.slice(DIAL[country].length)
      // +82 010… 처럼 0 을 남긴 채 적는 경우가 흔하다. 한국 대표번호(1588…)는 원래 0 이 없다
      const national = rest.startsWith('0') || (country === 'KR' && /^1[568]\d{6}$/.test(rest)) ? rest : `0${rest}`
      return { country, national }
    }
  }
  return null
}

/** 규칙에 맞으면 E.164, 아니면 null */
export function normalizePhone(raw: string, selected: PhoneCountry): string | null {
  const p = splitPhone(raw, selected)
  if (!p || !validNational(p.national, p.country)) return null
  const nsn = p.national.startsWith('0') ? p.national.slice(1) : p.national
  return `+${DIAL[p.country]}${nsn}`
}

/**
 * 서버용 — 국가번호가 없으면 우선 나라, 안 맞으면 다른 나라 규칙으로 본다(070 처럼 둘 다 맞으면 우선 나라).
 * 화면은 늘 E.164 로 보내지만, 배포 직후 예전 화면이 국가번호 없이 보내도 받기 위해서다. 화면 검증은 고른 나라만 본다.
 */
export function normalizePhoneInput(raw: string, preferred: PhoneCountry): string | null {
  return normalizePhone(raw, preferred) ?? normalizePhone(raw, preferred === 'KR' ? 'JP' : 'KR')
}

export function isValidPhone(raw: string, selected: PhoneCountry): boolean {
  return normalizePhone(raw, selected) !== null
}

/** 오류 문구 키. 입력에 국가번호가 있으면 그 나라 기준으로 안내한다 */
export function phoneErrorCountry(raw: string, selected: PhoneCountry): PhoneCountry {
  return splitPhone(raw, selected)?.country ?? selected
}

/** 저장값(E.164)을 나라·국내 번호로. E.164 가 아니거나 규칙에 안 맞으면 null */
export function parseStoredPhone(value: string | null | undefined): { country: PhoneCountry; national: string } | null {
  const v = (value ?? '').trim()
  if (!/^\+\d+$/.test(v)) return null
  const p = splitPhone(v, 'KR')
  return p && validNational(p.national, p.country) ? p : null
}

function groupNational(national: string, country: PhoneCountry): string {
  const n = national
  const cut = (...sizes: number[]) => {
    const out: string[] = []
    let i = 0
    for (const size of sizes) {
      out.push(n.slice(i, i + size))
      i += size
    }
    return out.join('-')
  }
  if (country === 'KR') {
    if (n.length === 8) return cut(4, 4)
    if (n.startsWith('02')) return n.length === 9 ? cut(2, 3, 4) : cut(2, 4, 4)
    return n.length === 10 ? cut(3, 3, 4) : cut(3, 4, 4)
  }
  if (n.length === 11) return cut(3, 4, 4)
  // 일본 유선은 지역번호 길이가 제각각이다. 도쿄·오사카(03·06)와 0120·0570·0800 만 따로 두고 나머지는 3-3-4
  if (/^0[36]/.test(n)) return cut(2, 4, 4)
  if (/^0(120|570|800)/.test(n)) return cut(4, 3, 3)
  return cut(3, 3, 4)
}

/** 화면 표기. 저장값을 읽을 수 없으면(예전 값) 그대로 돌려준다 */
export function formatPhone(value: string | null | undefined): string {
  const p = parseStoredPhone(value)
  return p ? groupNational(p.national, p.country) : (value ?? '').trim()
}

/**
 * 계약서 표기. 한국 번호는 국내 표기(010-1234-5678), 일본 번호는 국가번호를 붙인다(+81 90-1234-5678) —
 * 계약 당사자인 회사가 한국 법인이라 한국 번호가 기본이고, 외국 번호는 그대로 걸 수 있게 적는다.
 */
export function formatPhoneForContract(value: string | null | undefined): string {
  const p = parseStoredPhone(value)
  if (!p) return (value ?? '').trim()
  if (p.country === 'KR') return groupNational(p.national, 'KR')
  return `+${DIAL.JP} ${groupNational(p.national, 'JP').replace(/^0/, '')}`
}

/**
 * 같은 번호인지 비교할 열쇠 — 국가번호·앞 0·하이픈을 뗀 번호(national significant number).
 * '+821012345678' · '010-1234-5678' · '01012345678' · '0082 10 1234 5678' 이 모두 '1012345678' 이 된다.
 */
export function phoneMatchKey(value: string | null | undefined): string {
  const v = (value ?? '').trim()
  let digits = v.replace(/\D/g, '')
  const intl = v.startsWith('+') || digits.startsWith('00')
  if (intl) {
    digits = digits.replace(/^00/, '')
    const dial = PHONE_COUNTRIES.map((c) => DIAL[c]).find((d) => digits.startsWith(d))
    if (dial) digits = digits.slice(dial.length)
  }
  return digits.replace(/^0+/, '')
}

/**
 * 입력칸의 처음 나라. 저장된 번호의 나라 > 표지에서 하나만 고른 광고 국가 > 화면 언어(ja→일본, 그 밖→한국)
 */
export function defaultPhoneCountry(opts: { stored?: string | null; coverCountries?: readonly string[]; locale?: string }): PhoneCountry {
  const v = (opts.stored ?? '').trim().replace(/[\s-]/g, '')
  if (v.startsWith('+82')) return 'KR'
  if (v.startsWith('+81')) return 'JP'
  const cover = [...new Set((opts.coverCountries ?? []).map((c) => c.toUpperCase()).filter(isPhoneCountry))]
  if (cover.length === 1) return cover[0]!
  return opts.locale === 'ja' ? 'JP' : 'KR'
}

/** 입력칸 처음 값 — 저장된 번호를 나라와 국내 표기로 푼다. 읽을 수 없는 예전 값은 그대로 둔다 */
export function initialPhoneInput(stored: string | null | undefined, fallback: PhoneCountry): { country: PhoneCountry; value: string } {
  const p = parseStoredPhone(stored)
  return p ? { country: p.country, value: groupNational(p.national, p.country) } : { country: fallback, value: (stored ?? '').trim() }
}

/**
 * 입력칸을 벗어날 때 값 정리 — 올바른 번호면 국내 표기로 바꾸고, 국가번호를 적었으면 그 나라로 옮긴다.
 * 올바르지 않으면 null(고객이 적은 그대로 둔다)
 */
export function tidyPhoneInput(raw: string, selected: PhoneCountry): { country: PhoneCountry; value: string } | null {
  const e164 = normalizePhone(raw, selected)
  return e164 ? initialPhoneInput(e164, selected) : null
}

/** 페이지 언어에서 서버가 쓸 기본 나라(국가번호 없이 들어온 값에만 쓰인다) */
export const phoneCountryForLocale = (locale: string | undefined): PhoneCountry => (locale === 'ja' ? 'JP' : 'KR')
