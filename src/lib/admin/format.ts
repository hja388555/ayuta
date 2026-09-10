/**
 * 관리자 화면 표기 유틸. 화면은 한국어·Asia/Seoul 고정이다(관리자 전용).
 * 고객 화면의 로케일 분기(next-intl)와 섞지 않는다 — 여기는 [locale] 세그먼트 밖이다.
 */
const SEOUL_DATETIME = new Intl.DateTimeFormat('ko-KR', {
  timeZone: 'Asia/Seoul',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  hour12: false,
})

const SEOUL_DAY = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'Asia/Seoul',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
})

/** 금액은 최소단위 정수로 저장돼 있다(원=1, 엔=1) — 소수점을 만들지 않는다 */
export function formatAmount(amount: number, currency: 'KRW' | 'JPY'): string {
  return new Intl.NumberFormat(currency === 'KRW' ? 'ko-KR' : 'ja-JP', {
    style: 'currency',
    currency,
    maximumFractionDigits: 0,
  }).format(amount)
}

/** 없는 값은 대시로. 관리자 화면에서 빈칸은 "값이 없음"과 구분되지 않는다 */
export function formatDateTime(value: string | null | undefined): string {
  if (!value) return '—'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '—'
  return SEOUL_DATETIME.format(date)
}

export function formatDay(value: string | null | undefined, fallback = '미정'): string {
  if (!value) return fallback
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return fallback
  return SEOUL_DAY.format(date)
}

/** <input type="date"> 가 요구하는 'YYYY-MM-DD'. 값이 없으면 빈 문자열(미정) */
export function toDateInputValue(value: string | null | undefined): string {
  return formatDay(value, '')
}
