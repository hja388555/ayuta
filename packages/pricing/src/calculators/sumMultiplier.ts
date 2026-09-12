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
  /** 기간 키 → 줄 이름(화면 언어). 금액에는 관여하지 않는다 */
  periodLabels?: Record<string, string>,
): QuoteResult {
  const base = calculateSum(book, { items: sel.items })
  if (!base.ok) return base

  const factor = multipliers[sel.period]
  if (typeof factor !== 'number' || !Number.isFinite(factor) || factor <= 0) {
    return { ok: false, errors: [{ field: 'period', message: '기간을 선택해 주세요.' }] }
  }

  // 배수는 관리자가 입력하는 값이라 소수 둘째 자리까지만 받는다(pricing-settings 검증).
  // 여기서도 한 번 더 막는다 — 셋째 자리 이하가 섞이면 아래 정수 변환이 값을 조용히 바꾼다
  const hundredths = Math.round(factor * 100)
  if (Math.abs(factor * 100 - hundredths) > 1e-6) {
    return { ok: false, errors: [{ field: 'period', message: '기간 배수는 소수 둘째 자리까지만 쓸 수 있습니다.' }] }
  }

  // 정수끼리 곱한 뒤 나눈다. base * 1.15 처럼 부동소수를 곱하면 100 * 1.15 = 114.999… 가 되어
  // 내림에서 1원이 사라진다. 소수가 나오면 내림한다 — 올림하면 고객이 안 고른 1원을 낸다
  const total = minor(Math.floor((base.total * hundredths) / 100))
  // 줄 이름은 호출자가 넘긴 화면 언어 문구를 쓴다. 없으면(테스트·옛 호출) 예전 표기로 떨어진다
  const label = periodLabels?.[sel.period] ?? `기간 ${sel.period}`
  const lines = [...base.lines, { key: `period:${sel.period}`, label, amount: minor(0) }]
  return { ok: true, lines, total, currency: book.currency }
}
