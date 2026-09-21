import { NextResponse } from 'next/server'
import { getPayload } from 'payload'
import config from '@payload-config'
import { z } from 'zod'
import { verifyRecaptcha } from '@/lib/recaptcha'
import { resetPasswordMail } from '@/lib/mail/reset-password'

/**
 * 비밀번호 찾기(큐 Q28). 이메일로 재설정 링크를 보낸다.
 *
 * 응답은 계정이 있든 없든 같다 — 이 화면으로 가입 여부를 캐지 못하게. 탈퇴한 계정에는 보내지 않는다.
 * 토큰 발급·만료(1시간)는 Payload forgotPassword 가 하고, 메일은 언어별 문구로 여기서 직접 보낸다
 * (Payload 기본 메일은 영어 한 벌뿐이다).
 */
const BodySchema = z.object({
  email: z.string().trim().toLowerCase().email().max(320),
  locale: z.enum(['ko', 'ja']).default('ko'),
  recaptchaToken: z.string().max(4000).optional().default(''),
})

const ok = () => NextResponse.json({ ok: true })

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
  const { email, locale, recaptchaToken } = parsed.data
  if (!(await verifyRecaptcha(recaptchaToken, 'forgot_password'))) return ok()

  const payload = await getPayload({ config })
  const found = await payload.find({ collection: 'users', where: { email: { equals: email } }, limit: 1, depth: 0, overrideAccess: true })
  const user = found.docs[0]
  if (!user || user.deletedAt) return ok()

  const token = await payload.forgotPassword({ collection: 'users', data: { email }, disableEmail: true, overrideAccess: true })
  if (!token) return ok()

  const site = (process.env.NEXT_PUBLIC_SITE_URL || new URL(req.url).origin).replace(/\/$/, '')
  const mail = resetPasswordMail(locale, `${site}/${locale}/reset-password?token=${encodeURIComponent(token)}`)
  try {
    await payload.sendEmail({ to: email, replyTo: process.env.MAIL_REPLY_TO || undefined, ...mail })
  } catch (err) {
    // 발송 실패도 화면에는 같은 응답이다. 원인은 서버 로그로 본다
    payload.logger.error({ err }, '비밀번호 재설정 메일 발송 실패')
  }
  return ok()
}
