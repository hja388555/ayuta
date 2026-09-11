import { NextResponse } from 'next/server'
import { getPayload } from 'payload'
import config from '@payload-config'
import { z } from 'zod'
import { requireSuperForApi } from '@/lib/admin/require-super'
import { cancelInvite } from '@/lib/invites/service'

/** 쓰지 않은 초대 취소 — 최고관리자만. 이미 쓴 초대는 기록으로 남긴다 */
const BodySchema = z.object({ id: z.number().int().positive() }).strict()

export async function POST(req: Request): Promise<Response> {
  const gate = await requireSuperForApi()
  if ('response' in gate) return gate.response
  const parsed = BodySchema.safeParse(await req.json().catch(() => null))
  if (!parsed.success) return NextResponse.json({ error: 'invalid_input' }, { status: 400 })
  await cancelInvite(await getPayload({ config }), parsed.data.id)
  return NextResponse.json({ ok: true })
}
