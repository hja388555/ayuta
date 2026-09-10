import { NextResponse } from 'next/server'
import { z } from 'zod'
import { findOwnedOrder } from '@/lib/order-lookup'
import { createGuestProofCookie } from '@/lib/checkout/guest-proof'

/**
 * 비회원 주문 조회. 주문번호 + 이메일 + 연락처 세 가지가 모두 맞아야 한다(큐 Q21).
 *
 * 맞으면 주문 완료 화면과 같은 서명 쿠키(10분)를 주고 그 화면 경로를 돌려준다 — 이메일·연락처를
 * URL 에 싣지 않는다(I6). 틀리면 어느 값이 틀렸는지, 주문번호가 존재하는지 구분하지 않고 같은
 * 응답을 준다. 대량 대입 제한(rate limit)은 Q30 범위다.
 */
const BodySchema = z.object({
  orderNumber: z.string().trim().min(1).max(60),
  email: z.string().trim().email().max(200),
  phone: z.string().trim().min(1).max(40),
  locale: z.enum(['ko', 'ja']).optional().default('ko'),
})

export async function POST(req: Request): Promise<Response> {
  let raw: unknown
  try {
    raw = await req.json()
  } catch {
    return NextResponse.json({ error: 'not_found' }, { status: 404 })
  }
  const parsed = BodySchema.safeParse(raw)
  if (!parsed.success) return NextResponse.json({ error: 'not_found' }, { status: 404 })
  const { orderNumber, email, phone, locale } = parsed.data

  const order = await findOwnedOrder(orderNumber, { kind: 'guest', email, phone })
  if (!order) return NextResponse.json({ error: 'not_found' }, { status: 404 })

  const cookie = createGuestProofCookie(order.orderNumber, email, phone)
  const res = NextResponse.json({ ok: true, path: `/${locale}/order/complete?order=${encodeURIComponent(order.orderNumber)}` })
  res.cookies.set(cookie.name, cookie.value, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: cookie.maxAgeSeconds,
  })
  return res
}
