import { NextResponse } from 'next/server'
import { z } from 'zod'
import { authedPayload } from '@/lib/admin/orders-data'
import { requireSuperForApi } from '@/lib/admin/require-super'

/**
 * 광고 서비스 한 줄(이름·설명·계약서 방식·순서·공개 여부)을 고친다.
 * 관리자 광고 서비스 화면(/manage/services)이 부른다.
 *
 * Payload REST 를 화면에서 직접 부르지 않는 이유는 단가 라우트와 같다 — 응답 규약과 에러
 * 번역표를 관리자 API 하나로 맞추고, 바꿀 수 있는 필드를 여기서 명시적으로 좁힌다.
 *
 * 번호(no)·주소(slug)·계산 방식(model)은 이 경로로 못 바꾼다. 번호와 주소는 주문·계약서·단가가
 * 서로를 찾는 이름이고, 계산 방식을 바꾸면 이미 받은 주문과 계산이 어긋난다.
 * 저장은 overrideAccess 없이 세션 사용자로 한다 — 컬렉션 access(isActiveSuper)를 한 번 더 탄다.
 */
const BodySchema = z.object({
  id: z.number().int().positive(),
  nameKo: z.string().trim().min(1).max(100),
  nameJa: z.string().trim().min(1).max(100),
  descKo: z.string().trim().max(200).optional(),
  descJa: z.string().trim().max(200).optional(),
  contractMode: z.enum(['fixed', 'perQuote']),
  sortOrder: z.number().int().min(0).max(9999),
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

  const { id, ...data } = parsed.data
  try {
    const { payload, user } = await authedPayload()
    await payload.update({ collection: 'ad-services', id, data, user, overrideAccess: false })
    return NextResponse.json({ ok: true })
  } catch {
    // 없는 id·검증 실패·권한 거부가 모두 여기로 온다. 구분해 알려주지 않는다
    return NextResponse.json({ error: 'service_failed' }, { status: 400 })
  }
}
