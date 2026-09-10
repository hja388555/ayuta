/**
 * 왜 (gated) 라우트 그룹인가 —
 *
 * 이 레이아웃은 관리자로 로그인하지 않았으면 404 로 감춘다. manage/ 바로 아래에 두면
 * 로그인 화면(manage/login)까지 같은 게이트에 걸려 로그인할 방법이 없어진다. 그래서 로그인이
 * 필요한 페이지만 (gated) 안에 두고 manage/login 은 바깥에 둔다. 라우트 그룹은 URL 에
 * 나타나지 않으므로 주소는 그대로 /manage 다.
 * 앞으로 추가하는 관리자 페이지는 반드시 (gated) 안에 넣을 것.
 */
import { notFound } from 'next/navigation'
import { AuthError, requireAdmin } from '@/lib/dal'

export const dynamic = 'force-dynamic'

export default async function ManageLayout({ children }: { children: React.ReactNode }) {
  try {
    await requireAdmin()
  } catch (err) {
    // 예상된 인증 실패(비로그인·비관리자)만 404로 감춘다
    if (err instanceof AuthError) notFound()
    // 그 외(DB 장애 등)는 그대로 올려보내 500으로 드러낸다
    throw err
  }
  return <>{children}</>
}
