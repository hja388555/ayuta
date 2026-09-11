import 'server-only'
import { NextResponse } from 'next/server'
import type { CreateOrderResult } from './create-order'
import { createGuestProofCookie } from './guest-proof'

/**
 * 주문 생성 성공 응답. 카테고리 결제(/api/checkout)와 견적 결제(/api/quote/order)가 같은 모양·같은
 * 쿠키를 쓴다 — 완료 화면(/order/complete)은 어느 경로로 만든 주문인지 모른다.
 */
export function orderCreatedResponse(result: Extract<CreateOrderResult, { ok: true }>, isGuest: boolean): NextResponse {
  const res = NextResponse.json({
    ok: true,
    orderNumber: result.orderNumber,
    amount: result.amount,
    currency: result.currency,
  })

  // 비회원은 세션이 없다 — 주문 완료 화면이 본인 확인을 할 유일한 근거를 서명된 쿠키로
  // 넘긴다. 쿼리스트링에 이메일·연락처를 실으면 브라우저 히스토리·서버 로그·리퍼러로
  // 새어 나간다(I6). 회원은 세션 자체가 본인 확인이라 쿠키가 필요 없다
  if (isGuest) {
    const proof = createGuestProofCookie(result.orderNumber, result.orderer.email, result.orderer.phone)
    res.cookies.set(proof.name, proof.value, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: proof.maxAgeSeconds,
    })
  }

  return res
}
