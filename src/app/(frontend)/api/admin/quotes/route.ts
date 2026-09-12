import { NextResponse } from 'next/server'
import { getPayload } from 'payload'
import config from '@payload-config'
import { z } from 'zod'
import { AuthError, requireAdmin } from '@/lib/dal'
import { currencyForLocale } from '@/lib/payments/channel'
import { parseQuoteLines, quoteIssueProblem } from '@/lib/quotes/lines'
import { generateQuoteToken, hashQuoteToken, newQuoteNumber } from '@/lib/quotes/token'

/**
 * 5번 견적 발행. 관리자가 문의 상세 화면에서 부른다.
 *
 * - 합계는 서버가 라인으로 계산한다. 화면이 보낸 합계는 받지 않는다(바디에 필드가 없다).
 * - 같은 문의에 이미 발행된 견적이 있으면 회수하고 새로 발행한다 — 링크가 두 개 살아 있으면
 *   고객이 옛 금액으로 결제할 수 있다.
 * - 토큰 원문은 응답으로 한 번만 돌려준다. DB 에는 해시만 남으므로 다시 볼 방법이 없다 —
 *   링크를 잃어버리면 재발행한다.
 */
const BodySchema = z.object({
  inquiryId: z.number().int().positive(),
  lines: z.unknown(),
  validDays: z.number().int().min(1).max(30).optional().default(7),
})

export async function POST(req: Request): Promise<Response> {
  let user
  try {
    user = await requireAdmin()
  } catch (err) {
    if (err instanceof AuthError) {
      const status = err.code === 'UNAUTHENTICATED' ? 401 : 403
      return NextResponse.json({ error: status === 401 ? 'unauthenticated' : 'forbidden' }, { status })
    }
    throw err
  }

  let raw: unknown
  try {
    raw = await req.json()
  } catch {
    return NextResponse.json({ error: 'invalid_input' }, { status: 400 })
  }
  const body = BodySchema.safeParse(raw)
  if (!body.success) return NextResponse.json({ error: 'invalid_input' }, { status: 400 })
  const lines = parseQuoteLines(body.data.lines)
  if (!lines.ok) return NextResponse.json({ error: 'invalid_quote_lines' }, { status: 400 })
  // 발행 상한(단가 10억 · 수량 999 · 합계 100억). 999 × 100억 같은 오타 견적이 고객에게 나가지 않게
  const limit = quoteIssueProblem(lines.lines)
  if (limit) return NextResponse.json({ error: 'quote_too_large', detail: limit }, { status: 400 })

  const payload = await getPayload({ config })
  let inquiry
  try {
    inquiry = await payload.findByID({ collection: 'inquiries', id: body.data.inquiryId, depth: 0, overrideAccess: true })
  } catch {
    return NextResponse.json({ error: 'quote_failed' }, { status: 400 })
  }
  const locale = inquiry.locale === 'ja' ? 'ja' : 'ko'

  const now = new Date()
  // 같은 문의의 살아 있는 견적을 먼저 회수한다
  const { docs: live } = await payload.find({
    collection: 'quotes',
    where: { and: [{ inquiry: { equals: inquiry.id } }, { status: { equals: 'issued' } }] },
    limit: 100,
    depth: 0,
    overrideAccess: true,
  })
  for (const q of live) {
    await payload.update({ collection: 'quotes', id: q.id, data: { status: 'revoked', revokedAt: now.toISOString() }, overrideAccess: true })
  }

  const token = generateQuoteToken()
  const expiresAt = new Date(now.getTime() + body.data.validDays * 24 * 60 * 60 * 1000)
  const quote = await payload.create({
    collection: 'quotes',
    data: {
      quoteNumber: newQuoteNumber(now),
      inquiry: inquiry.id,
      lines: lines.lines,
      currency: currencyForLocale(locale),
      total: lines.total,
      tokenHash: hashQuoteToken(token),
      status: 'issued',
      issuedAt: now.toISOString(),
      expiresAt: expiresAt.toISOString(),
      issuedBy: user.id,
    },
    overrideAccess: true,
  })
  await payload.update({ collection: 'inquiries', id: inquiry.id, data: { status: 'quoted' }, overrideAccess: true })

  return NextResponse.json({
    ok: true,
    quoteId: quote.id,
    quoteNumber: quote.quoteNumber,
    path: `/${locale}/quote/${token}`,
    expiresAt: expiresAt.toISOString(),
    revokedCount: live.length,
  })
}
