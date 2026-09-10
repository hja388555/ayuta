import { minor, type Minor } from './types/index'

export type RefundQuote =
  | { rate: number; deduction: Minor; refundable: Minor }
  | { rate: 'undetermined' }

const DAY = 86_400_000
const KST_OFFSET = 9 * 60 * 60 * 1000

/** 한국 시간 자정으로 절단한 날짜값 */
const kstMidnight = (d: Date): number =>
  Math.floor((d.getTime() + KST_OFFSET) / DAY) * DAY

/** 신청일 − 광고 시작일. 시각이 아니라 한국 날짜로 센다 */
export function elapsedDays(adStart: Date, appliedAt: Date): number {
  return Math.round((kstMidnight(appliedAt) - kstMidnight(adStart)) / DAY)
}

export function refundRate(days: number): number {
  if (days < 0) return 0
  return Math.min(100, (days + 1) * 10)
}

/**
 * 광고 시작일이 없으면 공제율을 계산할 수 없다.
 * 0%로 가정하면 관리자가 시작일을 입력하기 전에 전액 환불이 나간다.
 */
export function quoteRefund(paid: Minor, adStart: Date | null, appliedAt: Date): RefundQuote {
  if (!adStart || Number.isNaN(adStart.getTime())) return { rate: 'undetermined' }

  const rate = refundRate(elapsedDays(adStart, appliedAt))
  // 내림한다. 올림하면 고객이 받을 돈이 1원 줄어든다
  const deduction = minor(Math.floor((paid * rate) / 100))
  return { rate, deduction, refundable: minor(paid - deduction) }
}
