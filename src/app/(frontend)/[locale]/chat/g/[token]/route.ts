import { NextResponse } from 'next/server'
import { getPayload } from 'payload'
import config from '@payload-config'
import { GUEST_COOKIE, guestCookieOptions } from '@/lib/chat/guest'
import { findGuestThreadByToken } from '@/lib/chat/service'

type Ctx = { params: Promise<{ locale: string; token: string }> }

/**
 * 비회원 채팅 링크. 토큰이 살아 있으면 이 브라우저에 쿠키를 심고 /[locale]/chat 으로 보낸다 —
 * 최종 주소에 토큰을 남기지 않는다(주소창·방문 기록·Referer 로 새지 않게).
 * 방이 종료돼도 링크는 쓸 수 있다(읽기·다시 문의). 끊는 방법은 관리자가 링크를 새로 발급하는 것뿐이다.
 */
export async function GET(req: Request, { params }: Ctx): Promise<Response> {
  const { locale: raw, token } = await params
  const locale = raw === 'ja' ? 'ja' : 'ko'
  const payload = await getPayload({ config })
  const thread = await findGuestThreadByToken(payload, token)
  const res = NextResponse.redirect(new URL(thread ? `/${locale}/chat` : `/${locale}/chat?link=invalid`, req.url), 303)
  res.headers.set('Referrer-Policy', 'no-referrer')
  res.headers.set('Cache-Control', 'no-store')
  if (thread) res.cookies.set(GUEST_COOKIE, token, guestCookieOptions())
  return res
}
