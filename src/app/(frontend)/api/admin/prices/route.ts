import { NextResponse } from 'next/server'
import { z } from 'zod'
import { authedPayload } from '@/lib/admin/orders-data'
import { requireSuperForApi } from '@/lib/admin/require-super'

/**
 * 단가 한 줄(KRW·JPY 금액, 사용 여부)을 고친다. 관리자 단가 화면(/manage/prices)이 부른다.
 *
 * Payload REST(PATCH /api/price-entries/:id)를 화면에서 직접 부르지 않는 이유는 notes 라우트와
 * 같다 — 응답 규약과 에러 번역표를 관리자 API 하나로 맞추고, 바꿀 수 있는 필드를 여기서
 * 명시적으로 좁힌다(key·category·라벨은 이 경로로 못 바꾼다 — 키가 바뀌면 계산기가 조용히
 * 단가를 못 찾는다).
 *
 * 금액 규칙(정수 최소단위, 0 이상)은 컬렉션 validate 가 최종 판정한다. 여기 zod 는 모양만 본다.
 * 저장은 overrideAccess 없이 세션 사용자로 한다 — 컬렉션 access(isActiveSuper)를 한 번 더 탄다.
 */
const BodySchema = z.object({
  id: z.number().int().positive(),
  priceKrw: z.number().int().min(0),
  priceJpy: z.number().int().min(0),
  active: z.boolean(),
})

export async function POST(req: Request): Promise<Response> {
  const gate = await requireSuperForApi()
  if ('response' in gate) return gate.response

  let raw: unknown
  try {
    raw = await req.json()
  } catch {
    return NextResponse.json({ error: 'invalid_input' }, { status: 400 })
  }
  const parsed = BodySchema.safeParse(raw)
  if (!parsed.success) return NextResponse.json({ error: 'invalid_input' }, { status: 400 })

  const { id, priceKrw, priceJpy, active } = parsed.data
  try {
    const { payload, user } = await authedPayload()
    await payload.update({
      collection: 'price-entries',
      id,
      data: { priceKrw, priceJpy, active },
      user,
      overrideAccess: false,
    })
    return NextResponse.json({ ok: true })
  } catch {
    // 없는 id·검증 실패·권한 거부가 모두 여기로 온다. 구분해 알려주지 않는다
    return NextResponse.json({ error: 'price_failed' }, { status: 400 })
  }
}
