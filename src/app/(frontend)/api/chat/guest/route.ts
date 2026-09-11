import { NextResponse } from 'next/server'
import { cookies, headers } from 'next/headers'
import { getPayload } from 'payload'
import config from '@payload-config'
import { getSessionUser } from '@/lib/dal'
import { clientIp, creationWindowStart, generateGuestToken, GUEST_COOKIE, guestCookieOptions, GuestStartSchema, hashClientIp, isCreationLimited } from '@/lib/chat/guest'
import { createGuestThread, guestThreadFromCookie, jsonError, readJson, threadView } from '@/lib/chat/service'

/**
 * 비회원: 로그인 없이 채팅 시작(Figma [v2] 12-B 285:2). 이름·이메일·연락처 + 개인정보 동의(필수)를 받고
 * 방을 만든 뒤 httpOnly 쿠키에 토큰을 넣는다(DB 에는 해시만). 이미 유효한 쿠키가 있으면 그 방을 그대로 쓴다.
 * 스팸 방지로 같은 IP(HMAC)에서 한 시간에 GUEST_CREATE_LIMIT 개까지만 만든다.
 */
export async function POST(req: Request): Promise<Response> {
  const raw = await readJson(req)
  const parsed = GuestStartSchema.safeParse(raw)
  if (!parsed.success) {
    const consent = raw && typeof raw === 'object' ? (raw as { consent?: unknown }).consent : undefined
    return jsonError(consent !== true ? 'consent_required' : 'invalid_input', 400)
  }
  if (await getSessionUser()) return jsonError('already_member', 409)

  const payload = await getPayload({ config })
  const existing = await guestThreadFromCookie(payload)
  if (existing) return NextResponse.json({ ok: true, thread: threadView(existing) })

  const h = await headers()
  const ipHash = hashClientIp(clientIp((n) => h.get(n)), process.env.PAYLOAD_SECRET ?? '')
  const recent = await payload.count({
    collection: 'chat-threads',
    where: { and: [{ guestIpHash: { equals: ipHash } }, { createdAt: { greater_than: creationWindowStart().toISOString() } }] },
    overrideAccess: true,
  })
  if (isCreationLimited(recent.totalDocs)) return jsonError('too_many_threads', 429)

  const token = generateGuestToken()
  const { name, email, phone, locale } = parsed.data
  const thread = await createGuestThread(payload, { name, email, phone, locale, token, ipHash, consentAt: new Date().toISOString() })
  ;(await cookies()).set(GUEST_COOKIE, token, guestCookieOptions())
  return NextResponse.json({ ok: true, thread: threadView(thread) })
}
