/**
 * 왜 (gated) 라우트 그룹인가 —
 *
 * 이 레이아웃은 2단계 인증이 안 끝났으면 /manage/verify로 redirect한다.
 * 만약 이 레이아웃이 manage/ 바로 아래에 있었다면 나중에 만들 manage/verify/page.tsx도
 * 같은 레이아웃 아래로 들어간다. 그러면 검증 화면에 들어가는 순간 이 레이아웃이 다시
 * OTP를 요구하고 다시 /manage/verify로 보내서 ERR_TOO_MANY_REDIRECTS가 된다 —
 * 즉 게이트를 통과할 방법 자체가 없어진다.
 *
 * 그래서 OTP를 요구하는 페이지만 (gated) 그룹 안에 두고, manage/verify/는 이 그룹
 * '바깥'(manage/verify/)에 만든다. 라우트 그룹은 URL에 나타나지 않으므로 주소는
 * 그대로 /manage 이고, verify 화면만 이 레이아웃의 적용 대상에서 빠진다.
 * 앞으로 추가하는 관리자 페이지는 반드시 (gated) 안에 넣을 것.
 * (verify 화면 자체 · 코드 발급 · 메일 발송은 별도 태스크 범위다)
 */
import { notFound, redirect } from 'next/navigation'
import { AuthError, OtpRequiredError, requireAdminVerified } from '@/lib/dal'

export const dynamic = 'force-dynamic'

export default async function ManageLayout({ children }: { children: React.ReactNode }) {
  try {
    await requireAdminVerified()
  } catch (err) {
    // 2단계 인증 미완료만 검증 화면으로 보낸다
    if (err instanceof OtpRequiredError) redirect('/manage/verify')
    // 예상된 인증 실패(비로그인·비관리자)만 404로 감춘다
    if (err instanceof AuthError) notFound()
    // 그 외(DB 장애 등)는 그대로 올려보내 500으로 드러낸다
    throw err
  }
  return <>{children}</>
}
