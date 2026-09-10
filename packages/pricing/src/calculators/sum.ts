import { minor, type PriceBook, type QuoteLine, type QuoteResult } from '../types/index'

export type SumSelection = { items: string[] }

export function calculateSum(book: PriceBook, sel: SumSelection): QuoteResult {
  if (sel.items.length === 0) {
    return { ok: false, errors: [{ field: 'items', message: '항목을 선택해 주세요.' }] }
  }

  // 같은 항목을 여러 번 보내도 한 번만 센다. 중복 전송으로 금액이 늘어나면 안 된다
  const keys = [...new Set(sel.items)]
  const missing = keys.filter((k) => !book.entries[k])
  // 없는 항목을 조용히 빼고 계산하면 고객이 고른 것과 다른 금액이 청구된다
  if (missing.length > 0) {
    return { ok: false, errors: [{ field: 'items', message: `단가가 없는 항목입니다: ${missing.join(', ')}` }] }
  }

  const lines: QuoteLine[] = keys.map((k) => {
    // 바로 위에서 missing 검사를 통과했으므로 여기서는 반드시 존재한다
    const e = book.entries[k]!
    return { key: e.key, label: e.label, amount: e.amount }
  })
  const total = minor(lines.reduce((acc, l) => acc + l.amount, 0))
  return { ok: true, lines, total, currency: book.currency }
}
