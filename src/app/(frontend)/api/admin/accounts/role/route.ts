import { NextResponse } from 'next/server'
import { getPayload } from 'payload'
import config from '@payload-config'
import { z } from 'zod'
import { requireSuperForApi } from '@/lib/admin/require-super'

/**
 * 계정 권한 변경 — 최고관리자만(요구사항 1-16 규칙 2).
 * - 자기 자신의 권한은 바꾸지 못한다(실수로 자기를 내려 관리자 화면에서 잠기는 사고 방지).
 * - 마지막 남은 최고관리자를 내리지 못한다 — 아무도 권한을 되돌릴 수 없게 된다.
 * - 탈퇴한 계정은 바꾸지 않는다.
 */
const BodySchema = z.object({ userId: z.number().int().positive(), role: z.enum(['customer', 'manager', 'super']) })

export async function POST(req: Request): Promise<Response> {
  const gate = await requireSuperForApi()
  if ('response' in gate) return gate.response
  const me = gate.user

  let raw: unknown
  try {
    raw = await req.json()
  } catch {
    return NextResponse.json({ error: 'invalid_input' }, { status: 400 })
  }
  const parsed = BodySchema.safeParse(raw)
  if (!parsed.success) return NextResponse.json({ error: 'invalid_input' }, { status: 400 })
  const { userId, role } = parsed.data
  if (userId === me.id) return NextResponse.json({ error: 'cannot_change_self' }, { status: 400 })

  const payload = await getPayload({ config })
  let target
  try {
    target = await payload.findByID({ collection: 'users', id: userId, depth: 0, overrideAccess: true })
  } catch {
    return NextResponse.json({ error: 'account_failed' }, { status: 400 })
  }
  if (target.deletedAt) return NextResponse.json({ error: 'account_failed' }, { status: 400 })

  if (target.role === 'super' && role !== 'super') {
    const { totalDocs } = await payload.count({
      collection: 'users',
      where: { and: [{ role: { equals: 'super' } }, { deletedAt: { exists: false } }] },
      overrideAccess: true,
    })
    if (totalDocs <= 1) return NextResponse.json({ error: 'last_super' }, { status: 400 })
  }

  await payload.update({ collection: 'users', id: userId, data: { role }, overrideAccess: true, context: { allowRoleAssignment: true } })
  return NextResponse.json({ ok: true })
}
