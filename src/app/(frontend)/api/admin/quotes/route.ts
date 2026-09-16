import { NextResponse } from 'next/server'
import { getPayload } from 'payload'
import config from '@payload-config'
import { z } from 'zod'
import { AuthError, requireAdmin } from '@/lib/dal'
import { currencyForLocale } from '@/lib/payments/channel'
import { parseQuoteLines, quoteIssueProblem } from '@/lib/quotes/lines'
import { quoteContractIssue } from '@/lib/quotes/quote-contract'
import { QUOTE_CATEGORY } from '@/lib/quotes/create-quote-order'
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
const ConsentSchema = z.object({
  key: z.string().trim().min(1).max(40),
  labelKo: z.string().trim().min(1).max(300),
  labelJa: z.string().trim().min(1).max(300),
  required: z.boolean(),
})

const BodySchema = z.object({
  inquiryId: z.number().int().positive(),
  lines: z.unknown(),
  validDays: z.number().int().min(1).max(30).optional().default(7),
  // 견적마다 계약서를 쓰는 서비스에서만 채워 온다(Q53). 고정 계약서 서비스는 비워 둔다
  contractTitle: z.string().trim().max(200).optional().default(''),
  contractBody: z.string().trim().max(20000).optional().default(''),
  contractConsents: z.array(ConsentSchema).max(20).optional().default([]),
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

  // 이 견적이 어떤 계약서 방식을 쓰는지는 서비스가 정한다. 견적 흐름은 문의형 서비스(5번)다 —
  // 관리자가 그 서비스를 「견적 발행 때마다 작성」으로 두면 문구·동의 항목을 여기서 받는다
  const { docs: svc } = await payload.find({
    collection: 'ad-services',
    where: { no: { equals: QUOTE_CATEGORY } },
    limit: 1,
    depth: 0,
    overrideAccess: true,
  })
  const contractMode = (svc[0]?.contractMode as 'fixed' | 'perQuote' | undefined) ?? 'perQuote'
  const contractProblem = quoteContractIssue(contractMode, {
    title: body.data.contractTitle,
    body: body.data.contractBody,
    consents: body.data.contractConsents,
  })
  if (contractProblem) return NextResponse.json({ error: contractProblem }, { status: 400 })

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
      // 발행 순간의 문구를 그대로 붙여 둔다. 필드가 update 를 막고 있어 이후에는 바뀌지 않는다
      ...(body.data.contractTitle ? { contractTitle: body.data.contractTitle } : {}),
      ...(body.data.contractBody ? { contractBody: body.data.contractBody } : {}),
      ...(body.data.contractConsents.length > 0 ? { contractConsents: body.data.contractConsents } : {}),
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
