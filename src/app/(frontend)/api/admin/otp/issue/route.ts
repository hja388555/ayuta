import { NextResponse } from 'next/server'
import { AuthError, requireAdmin } from '@/lib/dal'
import { issueAdminOtp } from '@/lib/admin/otp-issue'

/**
 * 관리자 2단계 인증 코드 발급. 로그인 직후, 또는 /manage/verify 의 "코드 다시 받기"가 부른다.
 * 로그인(비밀번호)은 됐지만 2단계 인증은 아직인 상태가 대상이라 requireAdmin 만 요구한다.
 * 받는 사람은 세션 사용자 본인뿐이다 — 바디를 읽지 않는다.
 */
export async function POST(): Promise<Response> {
  let user
  try {
    user = await requireAdmin()
  } catch (err) {
    if (err instanceof AuthError) {
      const status = err.code === 'UNAUTHENTICATED' ? 401 : 403
      const error = err.code === 'UNAUTHENTICATED' ? 'unauthenticated' : 'forbidden'
      return NextResponse.json({ error }, { status })
    }
    throw err
  }

  const result = await issueAdminOtp(user)
  if (!result.ok && result.reason === 'mail_not_configured') {
    return NextResponse.json({ error: 'mail_not_configured' }, { status: 503 })
  }
  if (!result.ok) return NextResponse.json({ error: 'otp_rate_limited' }, { status: 429 })
  // 코드는 응답에 싣지 않는다 — 메일(개발 중에는 서버 로그)로만 간다
  return NextResponse.json({ ok: true })
}
