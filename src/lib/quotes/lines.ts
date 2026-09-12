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

/**
 * 새로 발행할 때만 거는 상한. 위 스키마 상한(100억)은 이미 발행된 견적을 읽고 결제할 때도 쓰이므로
 * 낮추면 기존 링크가 깨진다 — 발행 경로(/api/admin/quotes)와 발행 화면만 이 값을 본다.
 */
export const ISSUE_MAX_UNIT_AMOUNT = 1_000_000_000 // 10억
export const ISSUE_MAX_TOTAL = 10_000_000_000 // 100억

/** 발행 상한 검사. 문제가 없으면 null, 있으면 화면에 그대로 보여 줄 문구 */
export function quoteIssueProblem(lines: Array<{ quantity: number; unitAmount: number }>): string | null {
  for (const [i, l] of lines.entries()) {
    if (!Number.isInteger(l.quantity) || l.quantity < 1 || l.quantity > MAX_QUANTITY) return `${i + 1}번 항목: 수량은 1~${MAX_QUANTITY} 사이 정수로 입력해 주세요.`
    if (!Number.isInteger(l.unitAmount) || l.unitAmount < 0 || l.unitAmount > ISSUE_MAX_UNIT_AMOUNT) return `${i + 1}번 항목: 금액은 0~10억 사이 정수로 입력해 주세요.`
  }
  const total = lines.reduce((sum, l) => sum + l.quantity * l.unitAmount, 0)
  if (total <= 0) return '합계가 0원보다 커야 합니다.'
  if (total > ISSUE_MAX_TOTAL) return '합계는 100억 이하여야 합니다. 수량·금액을 확인해 주세요.'
  return null
}

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
