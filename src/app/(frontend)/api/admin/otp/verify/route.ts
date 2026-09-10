import { NextResponse } from 'next/server'
import { z } from 'zod'
import { AuthError, requireAdmin, verifyAndConsumeAdminOtp } from '@/lib/dal'

/**
 * 관리자 2단계 인증 코드 확인. 성공하면 코드가 소비되고(consumedAt), 이후 requireAdminVerified
 * 가 통과한다 — 쿠키에 따로 표시하지 않는다(dal.ts: 검증 상태는 매 요청 DB 에서 확인).
 *
 * userId 는 세션에서만 가져온다(verifyAndConsumeAdminOtp 호출 규약). 틀린 코드·만료·발급
 * 안 됨·시도 초과를 구분해 알려주지 않는다 — 전부 invalid_code 다.
 */
const BodySchema = z.object({ code: z.string().regex(/^\d{6}$/) })

export async function POST(req: Request): Promise<Response> {
  let user
  try {
    user = await requireAdmin()
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
  if (!parsed.success) return NextResponse.json({ error: 'invalid_code' }, { status: 400 })

  const ok = await verifyAndConsumeAdminOtp(user.id, parsed.data.code)
  if (!ok) return NextResponse.json({ error: 'invalid_code' }, { status: 400 })
  return NextResponse.json({ ok: true })
}
