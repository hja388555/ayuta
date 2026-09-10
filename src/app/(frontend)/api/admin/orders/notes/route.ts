import { NextResponse } from 'next/server'
import { z } from 'zod'
import { AuthError, requireAdmin } from '@/lib/dal'
import { authedPayload } from '@/lib/admin/orders-data'

/**
 * 관리자가 주문 건에 연락메모를 남기는 경로.
 *
 * Payload REST(/api/order-notes)를 화면에서 직접 부르지 않고 이 경로를 따로 두는 이유는
 * 관리자 API 의 게이트(requireAdmin — 탈퇴 계정 차단 포함)와 응답 코드 규약을
 * transition·schedule 라우트와 한 가지로 맞추기 위해서다(화면의 에러 번역표가 하나다).
 */
const BodySchema = z.object({
  orderId: z.number().int().positive(),
  // 컬렉션 쪽 validate 도 공백만 있는 메모를 거부하지만, 여기서 먼저 막아 400 으로 낸다
  body: z.string().trim().min(1).max(5000),
})

export async function POST(req: Request): Promise<Response> {
  // transition·schedule 라우트와 같은 순서: 인증 먼저, 그다음 바디.
  try {
    await requireAdmin()
  } catch (err) {
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
  if (!parsed.success) return NextResponse.json({ error: 'invalid_input' }, { status: 400 })

  try {
    // overrideAccess 를 쓰지 않고 세션 사용자로 만든다 — 컬렉션의 beforeChange 훅이
    // author 를 req.user 에서만 채우기 때문이다. overrideAccess: true 로 넘기면
    // req.user 가 비어 author 가 null 인 익명 기록이 남는다(분쟁 근거로 못 쓴다).
    const { payload, user } = await authedPayload()
    const created = await payload.create({
      collection: 'order-notes',
      data: { order: parsed.data.orderId, body: parsed.data.body },
      user,
      overrideAccess: false,
    })
    return NextResponse.json({ ok: true, noteId: created.id })
  } catch {
    // 없는 주문 id·권한 거부·DB 오류가 모두 여기로 떨어진다. 어느 쪽인지 구분해
    // 알려주지 않는다 — transition 라우트와 같은 판단이다
    return NextResponse.json({ error: 'note_failed' }, { status: 400 })
  }
}
