import { NextResponse } from 'next/server'
import { z } from 'zod'
import { AuthError, OtpRequiredError, requireAdminVerified } from '@/lib/dal'
import { isSuperRole } from '@/lib/roles'
import { transitionOrder } from '@/lib/order-state'
import { ORDER_STATUSES } from '@/collections/Orders'

/**
 * 관리자가 주문 상태를 바꾸는 유일한 경로.
 *
 * 게이트는 /manage 화면과 똑같이 requireAdminVerified() 다 — 화면이 2단계 인증을
 * 요구하는데 API 가 세션만으로 통과하면 이 경로가 그 게이트의 뒷문이 된다.
 *
 * admin UI 의 일반 저장은 status 필드가 잠겨 있어 통하지 않는다 — 상태는 반드시
 * transitionOrder() 의 전이표·원자적 UPDATE·append-only 기록을 거쳐야 한다.
 * to 는 ORDER_STATUSES 화이트리스트로만 받는다: 임의 문자열이 들어오면 전이표에
 * 없는 상태가 orders.status 에 그대로 눌러앉는다.
 */
const BodySchema = z.object({
  orderId: z.number().int().positive(),
  // z.enum 은 최소 하나의 리터럴을 요구하므로 튜플로 좁혀 넘긴다
  to: z.enum(ORDER_STATUSES as unknown as [string, ...string[]]),
  // 감사 기록에만 남는 자유 입력. 길이를 막지 않으면 전이표가 쓰레기통이 된다
  reason: z.string().trim().max(500).optional(),
})

export async function POST(req: Request): Promise<Response> {
  // 인증을 먼저 본다 — 바디 파싱 결과(400 vs 401)로 로그인 여부를 알려주지 않는다.
  // OtpRequiredError 는 AuthError 의 하위 타입이므로 반드시 먼저 검사한다 —
  // 순서를 뒤집으면 2단계 인증 미완료가 그냥 '권한 없음'으로 뭉개진다.
  let user: Awaited<ReturnType<typeof requireAdminVerified>>
  try {
    user = await requireAdminVerified()
  } catch (err) {
    if (err instanceof OtpRequiredError) {
      return NextResponse.json({ error: 'otp_required' }, { status: 403 })
    }
    if (err instanceof AuthError) {
      const status = err.code === 'UNAUTHENTICATED' ? 401 : 403
      const error = err.code === 'UNAUTHENTICATED' ? 'unauthenticated' : 'forbidden'
      return NextResponse.json({ error }, { status })
    }
    throw err
  }

  let raw: unknown
  try {
    raw = await req.json()
  } catch {
    return NextResponse.json({ error: 'invalid_input' }, { status: 400 })
  }

  const parsed = BodySchema.safeParse(raw)
  // parsed.error 를 그대로 실어 보내지 않는다 — 필드명·스키마 내부가 새어 나간다
  if (!parsed.success) return NextResponse.json({ error: 'invalid_input' }, { status: 400 })

  const { orderId, to, reason } = parsed.data

  // 취소는 환불·정산으로 이어지는 되돌릴 수 없는 전이라 super 만 한다.
  // manager 에게는 "권한 없음"이지 "잘못된 전이"가 아니다 — 409 로 뭉개지 않는다
  if (to === 'cancelled' && !isSuperRole(user.role)) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 })
  }

  try {
    const ok = await transitionOrder(orderId, to as (typeof ORDER_STATUSES)[number], user.id, reason)
    if (!ok) return NextResponse.json({ error: 'invalid_transition' }, { status: 409 })
    return NextResponse.json({ ok: true, orderId, status: to })
  } catch {
    // 스택·SQL·드라이버 메시지를 클라이언트에 노출하지 않는다.
    // 없는 주문 id 도 여기로 떨어진다(findByID 가 던진다) — 존재 여부를 구분해
    // 알려주지 않는 편이 낫다
    return NextResponse.json({ error: 'transition_failed' }, { status: 400 })
  }
}
