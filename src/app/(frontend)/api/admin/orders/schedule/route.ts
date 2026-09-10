import { NextResponse } from 'next/server'
import { z } from 'zod'
import { AuthError, OtpRequiredError, requireAdminVerified } from '@/lib/dal'
import { SCHEDULE_FIELDS, setOrderSchedule, type SchedulePatch } from '@/lib/orders/schedule'

/**
 * 관리자가 계약기간·광고시작일을 확정하는 유일한 경로 (Q22-B).
 *
 * 게이트는 transition 라우트와 같은 requireAdminVerified() 다 — /manage 화면이 2단계
 * 인증을 요구하는데 이 API 가 세션만으로 통과하면 그 게이트의 뒷문이 된다.
 *
 * admin UI 의 일반 저장은 세 필드가 잠겨 있어 통하지 않는다(src/collections/Orders.ts).
 * 계약기간은 분쟁의 핵심 사실이라 "누가 언제 무엇에서 무엇으로" 바꿨는지가 반드시
 * order-schedule-changes 에 남아야 하고, 역순 기간 검증도 이 경로에서만 걸린다.
 */
// null 은 "미정으로 되돌리기"다. 키를 아예 안 보내면 그 필드는 건드리지 않는다 —
// 둘을 같은 값으로 뭉개면 시작일만 고치려는 저장이 종료일을 지워 버린다.
const Day = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .nullable()

const BodySchema = z
  .object({
    orderId: z.number().int().positive(),
    contractStart: Day.optional(),
    contractEnd: Day.optional(),
    adStartDate: Day.optional(),
  })
  .refine((v) => SCHEDULE_FIELDS.some((f) => f in v), { message: 'empty_patch' })

export async function POST(req: Request): Promise<Response> {
  // 인증을 먼저 본다 — 바디 파싱 결과(400 vs 401)로 로그인 여부를 알려주지 않는다.
  // OtpRequiredError 는 AuthError 의 하위 타입이므로 반드시 먼저 검사한다.
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

  // 보내지 않은 필드는 patch 에 넣지 않는다(zod 가 없는 키를 만들어 주지 않는다)
  const patch: SchedulePatch = {}
  for (const field of SCHEDULE_FIELDS) {
    if (field in parsed.data) patch[field] = parsed.data[field] ?? null
  }

  try {
    // actor 는 반드시 세션에서 뽑는다 — 클라이언트가 보낸 값을 믿으면 감사 기록의
    // "누가"가 위조 가능해지고, 그 순간 이력 전체가 근거로서 쓸모없어진다.
    const res = await setOrderSchedule(parsed.data.orderId, patch, user.id)
    if (res.ok) return NextResponse.json({ ok: true, orderId: parsed.data.orderId, changed: res.changed })
    if (res.reason === 'invalid_date' || res.reason === 'reversed_period') {
      // 어느 필드가 왜 틀렸는지는 detail 에 있지만 내보내지 않는다 — 화면이 이미
      // 아는 사실이고, 존재하지 않는 주문과 구분 가능한 정보도 되지 않아야 한다
      return NextResponse.json({ error: 'invalid_schedule' }, { status: 400 })
    }
    // not_found. 존재 여부를 구분해 알려주지 않는다(transition 라우트와 같은 판단)
    return NextResponse.json({ error: 'schedule_failed' }, { status: 400 })
  } catch {
    // 스택·SQL·드라이버 메시지를 클라이언트에 노출하지 않는다
    return NextResponse.json({ error: 'schedule_failed' }, { status: 400 })
  }
}
