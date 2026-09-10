import type { Metadata } from 'next'
import { notFound, redirect } from 'next/navigation'
import { AuthError, OtpRequiredError, requireAdmin, requireAdminVerified } from '@/lib/dal'
import { OtpVerifyForm } from '@/components/admin/OtpVerifyForm'

/**
 * 관리자 2단계 인증 코드 입력. (gated) 그룹 밖에 둔다 — 안에 두면 이 화면이 다시 OTP 를
 * 요구해 무한 redirect 가 된다((gated)/layout.tsx 주석).
 *
 * 로그인하지 않았거나 관리자가 아니면 404 — /manage 의 다른 화면과 같은 규칙이다.
 * 이미 인증을 끝냈으면 관리자 홈으로 보낸다.
 */
export const dynamic = 'force-dynamic'
export const metadata: Metadata = { title: 'AYUTA 관리자 확인', robots: { index: false, follow: false } }

export default async function VerifyPage() {
  let user
  try {
    user = await requireAdmin()
  } catch (err) {
    if (err instanceof AuthError) notFound()
    throw err
  }

  try {
    await requireAdminVerified()
    redirect('/manage')
  } catch (err) {
    // redirect() 는 예외로 동작한다 — OTP 미완료가 아니면 그대로 올려보낸다
    if (!(err instanceof OtpRequiredError)) throw err
  }

  return (
    <main style={{ padding: 40, fontFamily: 'sans-serif', color: '#3D4046' }}>
      <h1 style={{ fontSize: 20, marginBottom: 16 }}>2단계 인증</h1>
      <OtpVerifyForm email={user.email} />
    </main>
  )
}
