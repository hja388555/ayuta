import { NextResponse } from 'next/server'
import { getPayload } from 'payload'
import config from '@payload-config'
import { z } from 'zod'
import { requireSuperForApi } from '@/lib/admin/require-super'
import { createInvite } from '@/lib/invites/service'

/**
 * 관리자 초대 — 최고관리자만(요구사항 1-16 규칙 2). 관리자 권한이 붙은 계정은 이 초대(또는 seed 스크립트)로만 생긴다.
 * 이미 관리자인 이메일은 already_admin. 기존 고객 이메일이면 수락 시 그 계정의 권한이 올라간다.
 * 같은 이메일로 다시 부르면 이전 링크는 무효가 된다(= 다시 보내기).
 * 응답의 link 는 메일이 나가지 않았을 때만 싣는다 — 최고관리자가 직접 전달해야 하는 경우뿐이다.
 */
const BodySchema = z.object({ email: z.string().trim().email().max(200), role: z.enum(['manager', 'super']) }).strict()

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

  const site = process.env.NEXT_PUBLIC_SITE_URL?.trim() || new URL(req.url).origin
  const payload = await getPayload({ config })
  try {
    const r = await createInvite(payload, { ...parsed.data, inviter: { id: gate.user.id, email: gate.user.email }, site })
    if (!r.ok) return NextResponse.json({ error: r.error }, { status: r.error === 'already_admin' ? 409 : 400 })
    return NextResponse.json(r.sent ? { ok: true, sent: true } : { ok: true, sent: false, link: r.link })
  } catch {
    return NextResponse.json({ error: 'invite_failed' }, { status: 500 })
  }
}
