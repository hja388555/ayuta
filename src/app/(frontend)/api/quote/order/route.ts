import { NextResponse } from 'next/server'
import { getSessionUser } from '@/lib/dal'
import { createQuoteOrder } from '@/lib/quotes/create-quote-order'
import { orderCreatedResponse } from '@/lib/checkout/order-response'

/**
 * 5번 견적 링크(/quote/[token])의 결제 버튼이 부르는 쓰기 경로. 로그인을 요구하지 않는다 — 토큰이 인증이다.
 * 금액은 받지 않는다. customerId 는 /api/checkout 과 같은 이유로 바디가 아니라 세션에서 가져온다.
 */
export async function POST(req: Request): Promise<Response> {
  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ ok: false, reason: 'invalid_input' }, { status: 400 })
  }

  const sessionUser = await getSessionUser()
  const result = await createQuoteOrder(body, sessionUser?.id ?? null)

  if (!result.ok) {
    // 이미 다른 주문자 정보로 접수된 견적은 요청이 틀린 게 아니라 상태가 부딪친 것이라 409
    const status = result.reason === 'already_ordered' ? 409 : 400
    return NextResponse.json({ ok: false, reason: result.reason }, { status })
  }

  return orderCreatedResponse(result, !sessionUser)
}
