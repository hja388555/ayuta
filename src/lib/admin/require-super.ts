import 'server-only'
import { NextResponse } from 'next/server'
import { AuthError, requireAdmin, type SessionUser } from '@/lib/dal'
import { isSuperRole } from '@/lib/roles'

/**
 * 단가·기간 배수처럼 "곧 가격 변경"인 관리자 API 의 게이트.
 * 관리자 중 super 만 통과한다. 응답 코드는 transition·notes 라우트와 같다
 * (화면의 에러 번역표가 하나다). 통과하면 사용자, 막히면 그대로 돌려줄 응답을 준다.
 */
export async function requireSuperForApi(): Promise<{ user: SessionUser } | { response: Response }> {
  let user: SessionUser
  try {
    user = await requireAdmin()
  } catch (err) {
    if (err instanceof AuthError) {
      const status = err.code === 'UNAUTHENTICATED' ? 401 : 403
      const error = err.code === 'UNAUTHENTICATED' ? 'unauthenticated' : 'forbidden'
      return { response: NextResponse.json({ error }, { status }) }
    }
    throw err
  }
  // manager 는 조회만 — 가격을 바꾸는 권한은 최고관리자에게만 있다
  if (!isSuperRole(user.role)) return { response: NextResponse.json({ error: 'forbidden' }, { status: 403 }) }
  return { user }
}
