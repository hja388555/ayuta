/**
 * 관리자가 입력하는 단가(원·엔 공통) 상한. DB 컬럼은 numeric 이라 넘치지는 않지만,
 * JS 숫자는 2^53 을 넘으면 조용히 반올림돼 입력한 값과 다른 값이 저장된다.
 * 한 항목 단가가 10억을 넘을 일은 없으므로 오타(0 몇 개 더)를 여기서 막는다.
 * 화면(PriceBoard)과 API(/api/admin/prices)가 같은 값을 쓴다 — 순수 모듈이라 클라이언트에서 불러도 된다.
 */
export const MAX_PRICE_AMOUNT = 1_000_000_000

export type PriceAmountProblem = 'invalid' | 'too_large' | null

/** 입력 칸 문자열 또는 숫자를 검사한다. 빈칸·소수·음수는 invalid, 10억 초과는 too_large */
export function priceAmountProblem(raw: string | number): PriceAmountProblem {
  const text = typeof raw === 'number' ? String(raw) : raw.trim()
  if (!/^\d+$/.test(text)) return 'invalid'
  // 자릿수로 먼저 본다 — Number('99999999999999999') 는 이미 반올림된 값이다
  if (text.replace(/^0+(?=\d)/, '').length > String(MAX_PRICE_AMOUNT).length) return 'too_large'
  return Number(text) > MAX_PRICE_AMOUNT ? 'too_large' : null
}
