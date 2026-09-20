const VERIFY_URL = 'https://www.google.com/recaptcha/api/siteverify'
/** 구글 권장 기준선. 이보다 낮으면 사람보다 자동화에 가깝다고 본다 */
const MIN_SCORE = 0.5
const TIMEOUT_MS = 5000

type VerifyResponse = {
  success?: boolean
  score?: number
  action?: string
}

/**
 * reCAPTCHA v3 점수 확인. 비밀 키가 없으면 통과시킨다 — 로컬·CI 에서 폼이 막히지 않게 한다.
 * 구글에 닿지 못한 경우(타임아웃·장애)도 통과시킨다. 구글이 죽었다고 회원가입이 멈추면 안 된다.
 * 거절은 구글이 명시적으로 실패를 돌려주거나 점수가 기준 아래일 때만 한다.
 */
export async function verifyRecaptcha(token: unknown, action: string): Promise<boolean> {
  const secret = process.env.RECAPTCHA_SECRET_KEY
  if (!secret) return true
  if (typeof token !== 'string' || !token) return false

  let data: VerifyResponse
  try {
    const res = await fetch(VERIFY_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ secret, response: token }),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    })
    if (!res.ok) return true
    data = (await res.json()) as VerifyResponse
  } catch {
    return true
  }

  if (!data.success) return false
  // 다른 화면에서 받은 토큰을 옮겨 쓰는 것을 막는다
  if (data.action && data.action !== action) return false
  return typeof data.score === 'number' ? data.score >= MIN_SCORE : true
}
