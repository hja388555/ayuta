/**
 * 1:1 채팅의 순수 규칙(큐 Q37) — 입력 정리, 번역 방향, 전송 속도 제한, 화면 표시 순서.
 * DB·네트워크를 모르게 둬서 단위 테스트로 고정한다.
 */

export const MAX_BODY = 2000
export const RATE_LIMIT = 20
export const RATE_WINDOW_MS = 60_000

export type ChatLocale = 'ko' | 'ja'
export type DeeplLang = 'KO' | 'JA'

export const toChatLocale = (v: unknown): ChatLocale => (v === 'ja' ? 'ja' : 'ko')

/** 제어 문자를 지운다(줄바꿈·탭은 남긴다). 앞뒤 공백을 자른다. 빈 문자열이나 너무 긴 글은 null */
export function cleanBody(raw: string): string | null {
  const text = raw
    .replace(/\r\n?/g, '\n')
    // eslint-disable-next-line no-control-regex
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F-\u009F\u200B-\u200F\u202A-\u202E\u2066-\u2069\uFEFF]/g, '')
    .trim()
  if (text.length === 0 || text.length > MAX_BODY) return null
  return text
}

/**
 * 번역 목표 언어. null 이면 번역하지 않는다.
 * - 고객 글: 관리자가 읽도록 한국어로(원문이 이미 한국어인지는 DeepL 감지 결과로 따로 거른다)
 * - 관리자 글: 방 언어가 일본어일 때만 일본어로
 */
export function targetLang(sender: 'customer' | 'admin', threadLocale: ChatLocale): DeeplLang | null {
  if (sender === 'customer') return 'KO'
  return threadLocale === 'ja' ? 'JA' : null
}

/** 최근 1분 동안 보낸 수가 한도에 닿았는지 */
export const isRateLimited = (recentCount: number, limit = RATE_LIMIT) => recentCount >= limit
export const rateWindowStart = (now = new Date()) => new Date(now.getTime() - RATE_WINDOW_MS)

export type BubbleText = { primary: string; secondary: string | null }

/**
 * 말풍선에 무엇을 크게, 무엇을 작게 보일지. 보는 사람 언어로 된 쪽이 위(크게), 다른 쪽이 아래.
 * 번역이 없으면 원문 한 줄만.
 */
export function bubbleText(
  m: { body: string; translatedBody?: string | null; sourceLang?: string | null; translatedLang?: string | null; translationStatus?: string | null },
  viewer: ChatLocale,
): BubbleText {
  const translated = m.translationStatus === 'ok' && m.translatedBody ? m.translatedBody : null
  if (!translated) return { primary: m.body, secondary: null }
  const want = viewer.toUpperCase()
  if ((m.translatedLang ?? '').toUpperCase() === want && (m.sourceLang ?? '').toUpperCase() !== want) {
    return { primary: translated, secondary: m.body }
  }
  return { primary: m.body, secondary: translated }
}
