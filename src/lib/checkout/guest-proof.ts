import 'server-only'
import crypto from 'node:crypto'

// 비회원 주문 완료 화면(/order/complete)은 이메일·연락처를 본인 확인 근거로 쓴다.
// 예전엔 이 값을 쿼리스트링에 실어 보냈다 — URL은 브라우저 히스토리·서버 로그·리퍼러로
// 새어 나간다(I6). 대신 서버가 서명한 쿠키에 담아 넘긴다. 짧게 산다 — 결제 직후 한 번
// 쓰고 버리는 값이라 오래 남아 있을 이유가 없다.
const TTL_MS = 10 * 60 * 1000
export const GUEST_PROOF_COOKIE_NAME = 'ayuta_guest_proof'

function secret(): string {
  const s = process.env.PAYLOAD_SECRET
  if (!s) throw new Error('PAYLOAD_SECRET 이 설정되지 않았습니다')
  return s
}

function sign(payload: string): string {
  return crypto.createHmac('sha256', secret()).update(payload).digest('base64url')
}

type GuestProofPayload = { orderNumber: string; email: string; phone: string; exp: number }

/** /api/checkout 응답에 실을 쿠키 값을 만든다. 서버 서명이 있어 클라이언트가 값을 조작해도 걸린다 */
export function createGuestProofCookie(orderNumber: string, email: string, phone: string): { name: string; value: string; maxAgeSeconds: number } {
  const payload: GuestProofPayload = { orderNumber, email, phone, exp: Date.now() + TTL_MS }
  const encoded = Buffer.from(JSON.stringify(payload), 'utf8').toString('base64url')
  return { name: GUEST_PROOF_COOKIE_NAME, value: `${encoded}.${sign(encoded)}`, maxAgeSeconds: Math.floor(TTL_MS / 1000) }
}

/**
 * 쿠키에서 이메일·연락처를 꺼낸다. 서명이 안 맞거나, 만료됐거나, 다른 주문번호를 가리키면
 * null — 세 경우 모두 "본인 확인 실패"로 같게 취급해 어느 쪽인지 알려주지 않는다.
 */
export function readGuestProof(cookieValue: string | undefined, orderNumber: string): { email: string; phone: string } | null {
  if (!cookieValue) return null
  const [encoded, sig] = cookieValue.split('.')
  if (!encoded || !sig) return null
  if (sign(encoded) !== sig) return null
  try {
    const payload = JSON.parse(Buffer.from(encoded, 'base64url').toString('utf8')) as GuestProofPayload
    if (payload.exp < Date.now()) return null
    if (payload.orderNumber !== orderNumber) return null
    return { email: payload.email, phone: payload.phone }
  } catch {
    return null
  }
}
