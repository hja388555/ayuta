import { NextResponse } from 'next/server'
import { getPayload } from 'payload'
import config from '@payload-config'
import { z } from 'zod'
import { AuthError, requireUser } from '@/lib/dal'
import { PASSWORD_MAX, passwordIssue } from '@/lib/password-policy'

/**
 * 비밀번호 변경. 현재 비밀번호를 먼저 확인한다 — 잠깐 비워 둔 로그인 화면을 누가 쓰더라도
 * 비밀번호를 바꿔 계정을 가로채지 못하게. 확인은 Payload 로그인으로 한다(틀리면 실패 횟수가
 * 올라가 5회에 잠긴다 — 현재 비밀번호 대입도 같은 잠금에 걸린다).
 */
const BodySchema = z.object({
  currentPassword: z.string().min(1).max(128),
  newPassword: z.string().min(1).max(PASSWORD_MAX),
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
  // 새 비밀번호 규칙(Q34)을 현재 비밀번호 확인보다 먼저 본다 — 규칙 위반으로 로그인 실패 횟수를 쓰지 않게
  if (passwordIssue(parsed.data.newPassword)) return NextResponse.json({ error: 'weak_password' }, { status: 400 })
  // 같은 비밀번호로 "바꾸기"는 변경이 아니다. 둘 다 요청에 있는 값이라 현재 비밀번호 확인 전에 거절해도 새는 정보가 없다
  if (parsed.data.newPassword === parsed.data.currentPassword) return NextResponse.json({ error: 'same_password' }, { status: 400 })

  const payload = await getPayload({ config })
  try {
    await payload.login({ collection: 'users', data: { email: user.email, password: parsed.data.currentPassword } })
  } catch {
    return NextResponse.json({ error: 'wrong_password' }, { status: 400 })
  }
  await payload.update({ collection: 'users', id: user.id, data: { password: parsed.data.newPassword }, overrideAccess: true })
  return NextResponse.json({ ok: true })
}
