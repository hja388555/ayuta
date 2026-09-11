import { NextResponse } from 'next/server'
import { z } from 'zod'
import { chatGate, getOrCreateOwnThread, jsonError, openThreadForInquiry, readJson } from '@/lib/chat/service'
import { toChatLocale } from '@/lib/chat/rules'

const BodySchema = z.union([z.object({ inquiryId: z.number().int().positive() }).strict(), z.object({ orderId: z.number().int().positive() }).strict()])

/**
 * 관리자 "채팅 열기"(Figma A9 230:232 · 주문 상세 "고객 1:1 채팅 열기").
 * 문의: 회원이면 회원 방, 비회원이면 문의에 묶인 비회원 방을 찾거나 만든다.
 * 주문: 회원 주문만(비회원 주문은 연락처로 안내 — 409). 돌려준 id 로 /manage/inquiries?tab=chat&thread=<id> 를 연다.
 */
export async function POST(req: Request): Promise<Response> {
  const g = await chatGate('admin')
  if ('response' in g) return g.response
  const parsed = BodySchema.safeParse(await readJson(req))
  if (!parsed.success) return jsonError('invalid_input', 400)

  if ('inquiryId' in parsed.data) {
    const thread = await openThreadForInquiry(g.payload, parsed.data.inquiryId)
    if (!thread) return jsonError('not_found', 404)
    return NextResponse.json({ ok: true, threadId: thread.id })
  }

  let order
  try {
    order = await g.payload.findByID({ collection: 'orders', id: parsed.data.orderId, depth: 0, overrideAccess: true })
  } catch {
    return jsonError('not_found', 404)
  }
  const customer = order.customer
  const customerId = customer == null ? null : typeof customer === 'object' ? customer.id : customer
  if (customerId === null) return jsonError('guest_order', 409)
  const thread = await getOrCreateOwnThread(g.payload, customerId, toChatLocale(order.locale))
  return NextResponse.json({ ok: true, threadId: thread.id })
}
