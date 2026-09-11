import { createHash, randomBytes } from 'node:crypto'

/** 관리자 초대 유효 시간 — 72시간 */
export const INVITE_TTL_MS = 72 * 60 * 60 * 1000

/** 원본 토큰은 메일 링크에만 실린다. DB 에는 sha256 해시만 저장한다 */
export const generateInviteToken = (): string => randomBytes(32).toString('base64url')

export const hashInviteToken = (token: string): string => createHash('sha256').update(token, 'utf8').digest('hex')

/** 링크에서 받은 토큰이 생성 규칙(base64url 32바이트 = 43자)에 맞는지. 아니면 DB 조회도 하지 않는다 */
export const isWellFormedToken = (token: unknown): token is string => typeof token === 'string' && /^[A-Za-z0-9_-]{43}$/.test(token)

export const inviteExpiresAt = (now: Date = new Date()): Date => new Date(now.getTime() + INVITE_TTL_MS)

export const isInviteUsable = (invite: { usedAt?: string | null; expiresAt: string }, now: Date = new Date()): boolean =>
  !invite.usedAt && new Date(invite.expiresAt).getTime() > now.getTime()
