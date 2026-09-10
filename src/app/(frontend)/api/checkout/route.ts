import { NextResponse } from 'next/server'
import { getSessionUser } from '@/lib/dal'
import { createOrder } from '@/lib/checkout/create-order'

/**
 * 결제 직전 화면이 부르는 유일한 쓰기 경로.
 * customerId 는 요청 바디가 아니라 세션에서 가져온다 — 몸통에 customerId 를 실어 보내면
 * 로그인 없이도 다른 회원 번호로 주문을 만들 수 있게 된다.
 */
export async function POST(req: Request): Promise<Response> {
  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ ok: false, reason: 'invalid_input' }, { status: 400 })
  }

  const sessionUser = await getSessionUser()
  const result = await createOrder(body, sessionUser?.id ?? null)

  if (!result.ok) {
    // 어느 거부 사유든 클라이언트 조작·검증 실패다. 500 을 쓰지 않는다 —
    // 500 은 "서버가 고장났다"는 뜻이고 여기는 서버가 정상적으로 거부한 것이다
    return NextResponse.json({ ok: false, reason: result.reason }, { status: 400 })
  }

  return NextResponse.json({
    ok: true,
    orderNumber: result.orderNumber,
    amount: result.amount,
    currency: result.currency,
  })
}
