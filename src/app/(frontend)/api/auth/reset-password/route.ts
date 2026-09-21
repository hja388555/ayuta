import { NextResponse } from 'next/server'
import { APIError, getPayload } from 'payload'
import config from '@payload-config'
import { z } from 'zod'
import { PASSWORD_MAX, passwordIssue } from '@/lib/password-policy'

/**
 * 비밀번호 재설정(큐 Q28). 메일 링크의 토큰과 새 비밀번호를 받는다.
 * 토큰 확인·만료·1회용 처리는 Payload resetPassword 가 한다. 끝나면 로그인 화면에서 새 비밀번호로 들어온다 —
 * 여기서 로그인 쿠키를 주지 않는다(메일 링크만으로 로그인 상태가 되지 않게).
 */
const BodySchema = z.object({
  token: z.string().min(1).max(512),
  password: z.string().min(1).max(PASSWORD_MAX),
})

export async function POST(req: Request): Promise<Response> {
  if (!req.headers.get('content-type')?.toLowerCase().startsWith('application/json')) {
    return NextResponse.json({ error: 'invalid_input' }, { status: 415 })
  }
  let raw: unknown
  try {
    raw = await req.json()
  } catch {
    return NextResponse.json({ error: 'invalid_input' }, { status: 400 })
  }
  const parsed = BodySchema.safeParse(raw)
  if (!parsed.success) return NextResponse.json({ error: 'invalid_input' }, { status: 400 })
  if (passwordIssue(parsed.data.password)) return NextResponse.json({ error: 'weak_password' }, { status: 400 })

  const payload = await getPayload({ config })
  try {
    await payload.resetPassword({ collection: 'users', data: parsed.data, overrideAccess: true })
  } catch (err) {
    if (err instanceof APIError && err.status < 500) return NextResponse.json({ error: 'invalid_token' }, { status: 400 })
    throw err
  }
  return NextResponse.json({ ok: true })
}
