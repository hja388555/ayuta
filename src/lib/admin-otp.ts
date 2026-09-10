import { createHmac, randomBytes, randomInt, timingSafeEqual } from 'node:crypto'

export type OtpResult = 'ok' | 'expired' | 'mismatch'

/** 000000 ~ 999999. Math.random 을 쓰지 않는다 */
export const generateOtp = (): string => String(randomInt(0, 1_000_000)).padStart(6, '0')

export const newSalt = (): string => randomBytes(16).toString('hex')

/** 코드는 짧아서 그대로 저장하면 DB 유출 시 바로 쓰인다. HMAC으로 저장한다 */
export const hashOtp = (code: string, salt: string): string =>
  createHmac('sha256', salt).update(code).digest('hex')

export const verifyOtp = (
  input: string,
  hash: string,
  salt: string,
  expiresAt: Date,
  now: Date,
): OtpResult => {
  if (now.getTime() > expiresAt.getTime()) return 'expired'
  const expected = Buffer.from(hash, 'hex')
  const actual = Buffer.from(hashOtp(input, salt), 'hex')
  if (expected.length !== actual.length) return 'mismatch'
  return timingSafeEqual(expected, actual) ? 'ok' : 'mismatch'
}
