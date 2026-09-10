import type { Minor, PriceBook, QuoteLine, QuoteResult } from '../types/index'
import { minor } from '../types/index'

export type TierSelection = {
  /** 선택한 등급. 중복 선택 가능하며 금액은 합산된다 */
  tiers: string[]
  /** 선택한 플랫폼. 금액에 영향이 없다 */
  platforms: string[]
}

/**
 * 1번 디지털 · SNS 커뮤니티.
 *
 * 등급은 중복 선택 가능하고 선택한 등급의 단가를 합산한다 (2026-09-08 확정).
 * 플랫폼은 채널 선택일 뿐 금액에 영향을 주지 않는다.
 */
export function calculateTier(book: PriceBook, sel: TierSelection): QuoteResult {
  const errors: { field: string; message: string }[] = []

  if (sel.tiers.length === 0) {
    errors.push({ field: 'tiers', message: '등급을 하나 이상 선택해 주세요.' })
  }

  const lines: QuoteLine[] = []
  for (const key of sel.tiers) {
    const entry = book.entries[key]
    if (!entry) {
      errors.push({ field: 'tiers', message: `등록되지 않은 등급입니다: ${key}` })
      continue
    }
    lines.push({ key: entry.key, label: entry.label, amount: entry.amount })
  }

  if (errors.length > 0) return { ok: false, errors }

  const total = lines.reduce<number>((sum, line) => sum + line.amount, 0)
  return { ok: true, lines, total: minor(total) as Minor, currency: book.currency }
}
