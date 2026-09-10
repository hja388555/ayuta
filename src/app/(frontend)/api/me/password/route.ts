import { NextResponse } from 'next/server'
import { getPayload } from 'payload'
import config from '@payload-config'
import { z } from 'zod'
import { AuthError, requireUser } from '@/lib/dal'

/**
 * 비밀번호 변경. 현재 비밀번호를 먼저 확인한다 — 잠깐 비워 둔 로그인 화면을 누가 쓰더라도
 * 비밀번호를 바꿔 계정을 가로채지 못하게. 확인은 Payload 로그인으로 한다(틀리면 실패 횟수가
 * 올라가 5회에 잠긴다 — 현재 비밀번호 대입도 같은 잠금에 걸린다).
 */
const BodySchema = z.object({
  currentPassword: z.string().min(1).max(128),
  newPassword: z.string().min(8).max(128),
})

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
  const parsed = BodySchema.safeParse(raw)
  if (!parsed.success) return NextResponse.json({ error: 'invalid_input' }, { status: 400 })

  const payload = await getPayload({ config })
  try {
    await payload.login({ collection: 'users', data: { email: user.email, password: parsed.data.currentPassword } })
  } catch {
    return NextResponse.json({ error: 'wrong_password' }, { status: 400 })
  }
  await payload.update({ collection: 'users', id: user.id, data: { password: parsed.data.newPassword }, overrideAccess: true })
  return NextResponse.json({ ok: true })
}
