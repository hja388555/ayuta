import type { BadgeTone } from '@/components/ui'

/**
 * 관리자 주문 화면 표기(Figma [v2] A3 228:334 · A4 229:2). 관리자는 한국어 고정이라
 * messages/ko.json 의 categories 문구를 그대로 옮겨 둔다 — next-intl 을 거치지 않는다.
 */
const CATEGORY_LABELS: Record<number, string> = {
  1: '디지털 / SNS 광고',
  2: '현지 전문 영상 촬영',
  3: '대표신문 / 지역신문 / 블로그',
  4: '지하철 · 버스광고',
  5: '기타',
}

export function categoryLabel(no: number): string {
  const name = CATEGORY_LABELS[no]
  return name ? `${no}. ${name}` : `${no}번`
}

const PURPOSE_LABELS: Record<string, string> = {
  brand: '브랜드 회사 홍보',
  product: '제품 상품 홍보',
  store: '매장 음식점 홍보',
  medical: '병원·의료 홍보',
  event: '행사 이벤트 홍보',
  etc: '기타 원하시는 광고',
}

/** 표지에서 고른 광고 목적(복수 선택) — 관리자 표기용으로 쉼표로 이어붙인다 */
export function purposeLabel(purposes: readonly string[] | null | undefined): string {
  if (!purposes || purposes.length === 0) return '—'
  return purposes.map((p) => PURPOSE_LABELS[p] ?? p).join(', ')
}

const TONES: Record<string, BadgeTone> = {
  pending: 'neutral',
  paid: 'success',
  in_progress: 'warning',
  done: 'success',
  failed: 'danger',
  cancelled: 'danger',
  fraud_suspected: 'danger',
}

export const adminStatusTone = (status: string): BadgeTone => TONES[status] ?? 'neutral'

/** 목록의 주문일 — 'MM-DD'(Asia/Seoul) */
const SEOUL_MD = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Seoul', month: '2-digit', day: '2-digit' })
export function formatMonthDay(value: string | null | undefined): string {
  if (!value) return '—'
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? '—' : SEOUL_MD.format(date)
}
