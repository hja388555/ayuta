import { notFound, redirect } from 'next/navigation'
import { AuthError, OtpRequiredError, requireAdminVerified } from '@/lib/dal'

export default async function ManagePage() {
  let user
  try {
    user = await requireAdminVerified()
  } catch (err) {
    if (err instanceof OtpRequiredError) redirect('/manage/verify')
    // 예상된 인증 실패만 404로 감춘다. 진짜 장애는 그대로 올려보내 500으로 드러낸다
    if (err instanceof AuthError) notFound()
    throw err
  }

  return (
    <main style={{ padding: 40, fontFamily: 'sans-serif' }}>
      <h1>AYUTA 관리자</h1>
      <p>
        {user.email} · {user.role}
      </p>
    </main>
  )
}
