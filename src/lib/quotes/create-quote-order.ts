import 'server-only'
import { getPayload, type Payload } from 'payload'
import config from '@payload-config'
import { z } from 'zod'
import type { Currency } from '@ayuta/pricing'
import { OrdererSchema, normalizeOrdererPhone } from '../checkout/orderer'
import { persistOrder, type CreateOrderResult } from '../checkout/create-order'
import { hashQuoteToken, isQuoteTokenShape } from './token'
import { parseQuoteLines } from './lines'
import { isSameOrderer, quoteAccess, quoteOrderKey, quoteOrderLines } from './quote-order'

/** 견적은 5번(기타 광고)에만 있다 — 계약서 템플릿도 5번 것을 쓴다 */
export const QUOTE_CATEGORY = 5

// 금액·항목 필드는 아예 없다. 클라이언트가 amount·lines 를 실어 보내도 zod 가 버리고,
// 서버는 토큰으로 찾은 저장된 견적만 쓴다(요구사항 1-12). 멱등키도 받지 않는다 — 견적 id 로 서버가 만든다
const QuoteOrderInputSchema = z.object({
  token: z.string().max(100),
  locale: z.enum(['ko', 'ja']),
  consents: z.record(z.string(), z.boolean()).default({}),
  orderer: OrdererSchema,
  // 카테고리 결제와 같다 — 동의 체크 시 주문자명이 자동 기입되므로 다르면 조작이다
  signature: z.string().trim().min(1).max(100),
}).transform(normalizeOrdererPhone)

export type QuoteOrderResult = CreateOrderResult | { ok: false; reason: 'invalid_quote' | 'quote_expired' | 'quote_revoked' }

/** 토큰 원문으로 견적을 찾는다. 모양이 틀린 토큰은 DB 를 조회하지 않는다. 원문은 DB 에 없어 해시로 찾는다 */
export async function loadQuoteByToken(payload: Payload, token: string) {
  if (!isQuoteTokenShape(token)) return null
  const { docs } = await payload.find({
    collection: 'quotes',
    where: { tokenHash: { equals: hashQuoteToken(token) } },
    limit: 1,
    depth: 0,
    overrideAccess: true,
  })
  return docs[0] ?? null
}

/**
 * 견적 링크 결제 — 저장된 견적으로 pending 주문 한 건과 계약서 스냅샷을 만든다.
 * 계약서·동의·채번·저장 규칙은 카테고리 결제와 같은 persistOrder 를 쓴다.
 *
 * 멱등 정책: 견적 하나에 주문은 하나다(멱등키 = quote-<견적 id>).
 * - 같은 주문자(이메일·연락처 일치)가 다시 보내면 — 더블클릭·새로고침·결제 재시도 — 새로 만들지
 *   않고 이미 만든 pending 주문을 그대로 돌려준다. 결제(PortOne)가 붙어도 그 주문으로 다시 결제한다.
 * - 다른 주문자 정보로 보내면 already_ordered 로 거부한다. 앞 주문을 돌려주면 링크를 받은 다른
 *   사람이 앞 주문자의 계약서를 열게 되고, 새로 만들면 견적 하나에 주문이 여러 벌 생긴다.
 *   주문자 정보를 고쳐야 하면 관리자가 견적을 재발행한다(재발행은 새 견적 id = 새 멱등키).
 */
export async function createQuoteOrder(rawInput: unknown, customerId: number | null = null): Promise<QuoteOrderResult> {
  const parsed = QuoteOrderInputSchema.safeParse(rawInput)
  if (!parsed.success) return { ok: false, reason: 'invalid_input', detail: parsed.error.flatten() }
  const input = parsed.data

  if (input.signature !== input.orderer.name) return { ok: false, reason: 'signature_mismatch' }

  const payload = await getPayload({ config })
  const quote = await loadQuoteByToken(payload, input.token)
  // 없는 토큰은 무엇이 틀렸는지 알려주지 않는다(견적 화면과 같다)
  if (!quote) return { ok: false, reason: 'invalid_quote' }
  const access = quoteAccess(quote)
  if (access === 'revoked') return { ok: false, reason: 'quote_revoked' }
  if (access === 'expired') return { ok: false, reason: 'quote_expired' }

  // 발행 때 검증했지만 금액의 근거라 한 번 더 본다 — 라인이 깨졌거나 합계가 라인과 다르면 결제하지 않는다
  const lines = parseQuoteLines(quote.lines)
  if (!lines.ok || lines.total !== quote.total) return { ok: false, reason: 'invalid_quote' }

  const inquiryId = typeof quote.inquiry === 'object' && quote.inquiry ? quote.inquiry.id : quote.inquiry
  const inquiry = inquiryId
    ? await payload.findByID({ collection: 'inquiries', id: inquiryId as number, depth: 0, overrideAccess: true }).catch(() => null)
    : null
  const countries = Array.isArray(inquiry?.country) ? (inquiry.country as string[]) : []

  return persistOrder({
    payload,
    category: QUOTE_CATEGORY,
    locale: input.locale,
    // 통화는 견적이 정한다(발행 시 문의 언어로 고정). 화면 언어를 바꿔도 금액 단위가 흔들리지 않는다
    currency: quote.currency as Currency,
    consents: input.consents,
    orderer: input.orderer,
    signature: input.signature,
    idempotencyKey: quoteOrderKey(quote.id),
    customerId,
    canReuse: (existing) => isSameOrderer(existing.orderer, input.orderer),
    prepare: async () => quoteOrderLines({ quoteNumber: quote.quoteNumber, lines: lines.lines, total: lines.total }, countries, input.locale),
  })
}
