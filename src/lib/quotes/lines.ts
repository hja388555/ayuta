import { z } from 'zod'

/**
 * 관리자가 입력하는 5번 견적 라인. 금액은 정수 최소단위(원 = 1, 엔 = 1).
 * 합계는 여기서만 계산한다 — 화면이 보낸 합계는 받지 않는다(요구사항 1-12: 금액은 서버가
 * DB 견적 라인으로만 계산).
 */
export const MAX_LINES = 30
export const MAX_QUANTITY = 999
export const MAX_UNIT_AMOUNT = 10_000_000_000 // 100억 — 오타(0 하나 더)로 터무니없는 견적이 나가지 않게

export const QuoteLineSchema = z.object({
  label: z.string().trim().min(1).max(200),
  quantity: z.number().int().min(1).max(MAX_QUANTITY),
  unitAmount: z.number().int().min(0).max(MAX_UNIT_AMOUNT),
})
export type QuoteLine = z.infer<typeof QuoteLineSchema>

export const QuoteLinesSchema = z.array(QuoteLineSchema).min(1).max(MAX_LINES)

export function quoteTotal(lines: QuoteLine[]): number {
  return lines.reduce((sum, l) => sum + l.quantity * l.unitAmount, 0)
}

/** 라인을 검증하고 합계를 낸다. 합계 0원 견적은 결제할 것이 없으므로 거부한다 */
export function parseQuoteLines(raw: unknown): { ok: true; lines: QuoteLine[]; total: number } | { ok: false } {
  const parsed = QuoteLinesSchema.safeParse(raw)
  if (!parsed.success) return { ok: false }
  const total = quoteTotal(parsed.data)
  if (total <= 0 || !Number.isSafeInteger(total)) return { ok: false }
  return { ok: true, lines: parsed.data, total }
}
