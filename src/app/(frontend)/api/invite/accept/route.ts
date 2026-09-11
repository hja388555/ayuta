import { NextResponse } from 'next/server'
import { getPayload } from 'payload'
import config from '@payload-config'
import { z } from 'zod'
import { passwordIssue } from '@/lib/password-policy'
import { isAdminRole } from '@/lib/roles'
import { isWellFormedToken } from '@/lib/invites/token'
import { claimInvite, releaseInvite } from '@/lib/invites/service'

/**
 * 관리자 초대 수락. 없는·쓴·만료된 토큰은 모두 같은 invalid_invite 로 답한다(어느 쪽인지 알려주지 않는다).
 * 초대를 먼저 원자적으로 차지한 뒤 계정을 만든다(또는 기존 고객 계정의 권한·비밀번호를 바꾼다).
 * 계정 처리에 실패하면 초대를 되돌려 다시 쓸 수 있게 한다.
 */
const BodySchema = z
  .object({
    token: z.string().max(100),
    name: z.string().trim().min(1).max(100),
    phone: z.string().trim().min(1).max(40),
    password: z.string().max(1000),
    passwordConfirm: z.string().max(1000),
  })
  .strict()

const invalid = () => NextResponse.json({ error: 'invalid_invite' }, { status: 400 })

export async function POST(req: Request): Promise<Response> {
  const parsed = BodySchema.safeParse(await req.json().catch(() => null))
  if (!parsed.success) return NextResponse.json({ error: 'invalid_input' }, { status: 400 })
  const d = parsed.data
  if (!isWellFormedToken(d.token)) return invalid()
  if (passwordIssue(d.password)) return NextResponse.json({ error: 'weak_password' }, { status: 400 })
  if (d.password !== d.passwordConfirm) return NextResponse.json({ error: 'password_mismatch' }, { status: 400 })

  const payload = await getPayload({ config })
  const invite = await claimInvite(payload, d.token)
  if (!invite) return invalid()

  try {
    const { docs } = await payload.find({ collection: 'users', where: { email: { equals: invite.email } }, limit: 1, depth: 0, overrideAccess: true })
    const existing = docs[0]
    // 초대 이후 누군가 이미 관리자로 만들었거나 탈퇴 계정이면 건드리지 않는다
    if (existing && (existing.deletedAt || isAdminRole(existing.role))) {
      await releaseInvite(payload, invite.id)
      return invalid()
    }
    if (existing) {
      await payload.update({
        collection: 'users',
        id: existing.id,
        data: { role: invite.role, password: d.password, name: d.name, phone: d.phone },
        overrideAccess: true,
        context: { allowRoleAssignment: true },
      })
    } else {
      await payload.create({
        collection: 'users',
        data: { email: invite.email, password: d.password, name: d.name, phone: d.phone, role: invite.role, postalCode: '-', address1: '-' },
        overrideAccess: true,
        context: { allowRoleAssignment: true },
      })
    }
  } catch (err) {
    payload.logger.error({ msg: '초대 수락 계정 처리 실패', err: err instanceof Error ? err.name : 'unknown' })
    await releaseInvite(payload, invite.id).catch(() => {})
    return invalid()
  }
  return NextResponse.json({ ok: true })
}
