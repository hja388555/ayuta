import createMiddleware from 'next-intl/middleware'
import { routing } from './i18n/routing'

// Next 16 에서는 middleware.ts 가 아니라 proxy.ts 다
export default createMiddleware(routing)

export const config = {
  // 관리자 경로(/manage)와 API·정적 파일은 로케일 협상 대상이 아니다.
  // /manage 가 로케일 프리픽스를 받으면 관리자 게이트가 깨진다.
  matcher: ['/((?!api|manage|_next|_vercel|.*\\..*).*)'],
}
