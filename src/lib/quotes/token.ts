import { createHash, randomBytes } from 'node:crypto'

/**
 * 5번 견적 링크 토큰. 128bit 랜덤을 URL 에 넣기 좋은 base64url(22자)로 쓴다(요구사항 1-12).
 *
 * DB 에는 원문이 아니라 SHA-256 해시만 저장한다 — 토큰이 곧 로그인 없는 인증이라, DB 가
 * 새면 원문으로는 모든 견적 링크가 되살아나지만 해시로는 못 되살린다. 토큰이 충분히 길고
 * 무작위라 솔트가 필요 없다(사전 대입이 성립하지 않는다).
 */
export const generateQuoteToken = (): string => randomBytes(16).toString('base64url')

export const hashQuoteToken = (token: string): string => createHash('sha256').update(token).digest('hex')

/** URL 에서 온 값이 토큰 모양인지. 모양이 틀리면 DB 를 조회하지 않는다 */
export const isQuoteTokenShape = (value: string): boolean => /^[A-Za-z0-9_-]{22}$/.test(value)

/** 표시용 견적번호. 식별은 id·토큰으로 하고 이 값은 사람이 부르기 위한 것이다 */
export const newQuoteNumber = (now = new Date()): string => {
  const ymd = now.toISOString().slice(0, 10).replace(/-/g, '')
  return `Q-${ymd}-${randomBytes(3).toString('hex').toUpperCase()}`
}
