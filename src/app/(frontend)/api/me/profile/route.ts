import { NextResponse } from 'next/server'
import { getPayload } from 'payload'
import config from '@payload-config'
import { z } from 'zod'
import { AuthError, requireUser } from '@/lib/dal'

/**
 * 마이페이지 정보 수정. 바꿀 수 있는 필드를 여기서 명시적으로 좁힌다 — role·email·deletedAt 은
 * 이 경로로 못 바꾼다(요구사항 1-16 규칙 1). 이메일 변경은 새 주소 인증 메일이 필요해 Q28 이후.
 */
const BodySchema = z
  .object({
    name: z.string().trim().min(1).max(100),
    phone: z.string().trim().min(1).max(40),
    postalCode: z.string().trim().min(1).max(20),
    address1: z.string().trim().min(1).max(200),
    address2: z.string().trim().max(200).optional().default(''),
  })
  .strict()

export async function POST(req: Request): Promise<Response> {
  let user
  try {
    user = await requireUser()
  } catch (err) {
    if (err instanceof AuthError) return NextResponse.json({ error: 'unauthenticated' }, { status: 401 })
    throw err
  }
  let raw: unknown
  try {
    raw = await req.json()
  } catch {
    return NextResponse.json({ error: 'invalid_input' }, { status: 400 })
  }
  // strict: 모르는 필드(role 등)가 섞이면 통째로 거부한다 — 조용히 버리면 공격 시도가 드러나지 않는다
  const parsed = BodySchema.safeParse(raw)
  if (!parsed.success) return NextResponse.json({ error: 'invalid_input' }, { status: 400 })
  const d = parsed.data

  const payload = await getPayload({ config })
  await payload.update({
    collection: 'users',
    id: user.id,
    data: { name: d.name, phone: d.phone, postalCode: d.postalCode, address1: d.address1, address2: d.address2 || null },
    overrideAccess: true,
  })
  return NextResponse.json({ ok: true })
}
