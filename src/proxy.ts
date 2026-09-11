import createMiddleware from 'next-intl/middleware'
import { NextResponse, type NextRequest } from 'next/server'
import { localeFromCountry, localeFromPath } from './i18n/geo'
import { routing } from './i18n/routing'

const handleI18n = createMiddleware(routing)

// Next 16 에서는 middleware.ts 가 아니라 proxy.ts 다
export default function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl

  // 프리픽스 없는 주소는 브라우저 언어·쿠키가 아니라 접속 국가(IP)로 언어를 정한다(대표님 결정 2026-09-11).
  // 언어 전환 버튼은 /ko·/ja 주소로 이동하므로 선택한 언어는 그대로 유지된다
  if (!localeFromPath(pathname)) {
    const url = request.nextUrl.clone()
    const locale = localeFromCountry(request.headers.get('x-vercel-ip-country'))
    url.pathname = `/${locale}${pathname === '/' ? '' : pathname}`
    return NextResponse.redirect(url)
  }

  return handleI18n(request)
}

export const config = {
  // 관리자 경로(/manage)와 API·정적 파일은 로케일 협상 대상이 아니다.
  // /manage 가 로케일 프리픽스를 받으면 관리자 게이트가 깨진다.
  matcher: ['/((?!api|manage|_next|_vercel|.*\\..*).*)'],
}
