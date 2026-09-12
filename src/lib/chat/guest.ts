import { createHash, createHmac, randomBytes } from 'node:crypto'
import { z } from 'zod'
import { isValidPhone } from '../phone'

/**
 * 비회원 1:1 채팅의 순수 규칙(2026-09-12 사용자 결정 "비회원도 채팅 가능").
 * DB·요청 객체를 모르게 둬서 단위 테스트로 고정한다.
 *
 * 토큰: 256bit 랜덤 base64url(43자). 쿠키와 채팅 링크(/[locale]/chat/g/<token>)에 같은 값이 들어간다.
 * DB 에는 SHA-256 해시만 둔다(견적 링크·관리자 초대와 같은 방식) — DB 가 새도 방에 들어갈 수 없다.
 * 관리자가 "채팅 링크 복사"로 새 토큰을 만들면 해시가 바뀌어 이전 링크·이전 쿠키가 함께 끊긴다.
 */

export const GUEST_COOKIE = 'ayuta_chat_guest'
export const GUEST_COOKIE_MAX_AGE = 60 * 60 * 24 * 90
/** 한 IP(해시)에서 한 시간에 만들 수 있는 비회원 방 수 */
export const GUEST_CREATE_LIMIT = 5
export const GUEST_CREATE_WINDOW_MS = 60 * 60 * 1000

export const generateGuestToken = (): string => randomBytes(32).toString('base64url')
export const hashGuestToken = (token: string): string => createHash('sha256').update(token).digest('hex')
/** 쿠키·URL 에서 온 값이 토큰 모양인지. 모양이 틀리면 DB 를 조회하지 않는다 */
export const isGuestTokenShape = (value: unknown): value is string => typeof value === 'string' && /^[A-Za-z0-9_-]{43}$/.test(value)

export const guestCookieOptions = (production = process.env.NODE_ENV === 'production') => ({
  httpOnly: true,
  secure: production,
  sameSite: 'lax' as const,
  path: '/',
  maxAge: GUEST_COOKIE_MAX_AGE,
})

export const GuestStartSchema = z
  .object({
    name: z.string().trim().min(1).max(100),
    email: z.string().trim().email().max(200),
    // 숫자가 최소 6개는 있어야 연락처로 본다(+·-·공백·괄호는 허용) — 마이페이지 회원정보와 같은 규칙(lib/phone)
    phone: z.string().trim().refine(isValidPhone),
    consent: z.literal(true),
    locale: z.enum(['ko', 'ja']),
  })
  .strict()
export type GuestStart = z.infer<typeof GuestStartSchema>

/**
 * 요청한 쪽을 대충 가르는 키. Vercel 은 x-real-ip·x-forwarded-for 를 자기가 덮어쓰므로 운영에서는 믿을 만하고,
 * 그 밖의 환경에서는 조작될 수 있다(최선 노력). 원문 IP 는 저장하지 않고 비밀값으로 HMAC 한 값만 쓴다.
 */
export function clientIp(get: (name: string) => string | null): string {
  const real = get('x-real-ip')?.trim()
  if (real) return real
  const forwarded = get('x-forwarded-for')?.split(',')[0]?.trim()
  return forwarded || 'unknown'
}
export const hashClientIp = (ip: string, secret: string): string => createHmac('sha256', `chat-guest-ip:${secret}`).update(ip).digest('hex')

export const isCreationLimited = (recentCount: number, limit = GUEST_CREATE_LIMIT) => recentCount >= limit
export const creationWindowStart = (now = new Date()) => new Date(now.getTime() - GUEST_CREATE_WINDOW_MS)

type Rel = number | { id: number } | null | undefined
type OwnerFields = { customer?: Rel; guestName?: string | null; guestEmail?: string | null }

/**
 * 방 주인이 있는지. 회원(customer) 또는 비회원 이름·이메일 둘 중 하나는 반드시 있어야 한다.
 * 부분 수정(안 읽음 수만 바꾸기 등)은 원래 문서와 합쳐서 본다.
 */
export function hasThreadOwner(data: OwnerFields | undefined, original?: OwnerFields | null): boolean {
  const merged = { ...(original ?? {}), ...(data ?? {}) }
  if (merged.customer != null) return true
  return Boolean(merged.guestName?.trim() && merged.guestEmail?.trim())
}
