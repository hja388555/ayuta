import { minor, type PriceBook, type QuoteResult } from '../types/index'
import { calculateSum } from './sum'

export type SumMultiplierSelection = { items: string[]; period: string }

/**
 * 항목을 더한 뒤 기간 배수를 곱한다.
 * 모르는 기간을 배수 1로 떨어뜨리면 고객이 6개월을 고르고 1개월 값을 낼 수 있다.
 */
export function calculateSumMultiplier(
  book: PriceBook,
  multipliers: Record<string, number>,
  sel: SumMultiplierSelection,
): QuoteResult {
  const base = calculateSum(book, { items: sel.items })
  if (!base.ok) return base

  const factor = multipliers[sel.period]
  if (typeof factor !== 'number' || !Number.isFinite(factor) || factor <= 0) {
    return { ok: false, errors: [{ field: 'period', message: '기간을 선택해 주세요.' }] }
  }

  // 소수가 나오면 내림한다. 올림하면 고객이 안 고른 1원을 낸다
  const total = minor(Math.floor(base.total * factor))
  const lines = [...base.lines, { key: `period:${sel.period}`, label: `기간 ${sel.period}`, amount: minor(0) }]
  return { ok: true, lines, total, currency: book.currency }
}
