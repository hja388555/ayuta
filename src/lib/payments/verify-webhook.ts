import { createHmac, timingSafeEqual } from 'node:crypto'

export type WebhookHeaders = {
  id?: string | null
  timestamp?: string | null
  signature?: string | null
}
export type WebhookVerdict = { ok: true; id: string } | { ok: false; reason: string }

export const TOLERANCE_SECONDS = 300

function safeEqual(a: string, b: string): boolean {
  const ba = Buffer.from(a)
  const bb = Buffer.from(b)
  // 길이가 다르면 timingSafeEqual 이 던진다. 길이 비교 자체는 비밀이 아니다
  if (ba.length !== bb.length) return false
  return timingSafeEqual(ba, bb)
}

/**
 * Standard Webhooks 규격 검증.
 * 서명 대상은 `{id}.{timestamp}.{원문}` 이며, 원문은 반드시 수신한 문자열 그대로여야 한다.
 * JSON 으로 파싱했다가 다시 직렬화하면 키 순서와 공백이 달라져 서명이 반드시 깨진다.
 */
export function verifyWebhook(
  rawBody: string,
  headers: WebhookHeaders,
  secret: string,
  now: Date = new Date(),
): WebhookVerdict {
  const { id, timestamp, signature } = headers
  if (!id || !timestamp || !signature) return { ok: false, reason: '서명 헤더가 없습니다.' }

  const ts = Number(timestamp)
  if (!Number.isFinite(ts)) return { ok: false, reason: '요청 시각이 올바르지 않습니다.' }
  const drift = Math.abs(Math.floor(now.getTime() / 1000) - ts)
  if (drift > TOLERANCE_SECONDS) return { ok: false, reason: '요청 시각이 허용 범위를 벗어났습니다.' }

  const key = Buffer.from(secret.replace(/^whsec_/, ''), 'base64')
  const expected = createHmac('sha256', key).update(`${id}.${timestamp}.${rawBody}`).digest('base64')

  // 키 교체 기간에는 서명이 공백으로 구분된 여러 개로 온다
  const candidates = signature.split(' ').map((s) => (s.startsWith('v1,') ? s.slice(3) : s))
  const matched = candidates.some((c) => safeEqual(c, expected))
  if (!matched) return { ok: false, reason: '서명이 일치하지 않습니다.' }

  return { ok: true, id }
}
