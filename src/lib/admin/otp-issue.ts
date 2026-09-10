import 'server-only'
import { getPayload } from 'payload'
import config from '@payload-config'
import { generateOtp, hashOtp, newSalt } from '@/lib/admin-otp'
import type { SessionUser } from '@/lib/dal'
import { otpDelivery } from './otp-delivery'

/** 코드 유효 시간. 메일을 열어 입력하기까지 충분하고, 새어 나가도 오래 못 쓰는 길이 */
export const OTP_TTL_MS = 10 * 60 * 1000

/**
 * 사용자당·시간창당 발급 상한. dal.ts verifyAndConsumeAdminOtp 주석의 발급 측 규약이다 —
 * 시도 캡(코드 한 건당 5회)만 있으면 "재발송"을 반복해 10^6 공간을 전수 대입할 수 있다.
 * 1시간 5건 × 5회 = 25회/시간 → 한 코드를 맞힐 확률이 사실상 0 이 된다.
 */
export const OTP_ISSUE_LIMIT = 5
export const OTP_ISSUE_WINDOW_MS = 60 * 60 * 1000

export type IssueResult = { ok: true } | { ok: false; reason: 'rate_limited' | 'mail_not_configured' }

/**
 * 관리자 2단계 인증 코드를 발급하고 보낸다. 코드는 해시로만 저장하고 응답에 싣지 않는다.
 *
 * 전달 방식은 otpDelivery 가 정한다. 메일 어댑터(Q28)가 붙기 전 개발 환경에서는 코드를
 * 서버 로그에 직접 남기고, 운영 환경에서는 발급을 거부한다(이유는 otp-delivery.ts).
 *
 * ⚠ user 는 반드시 세션(requireAdmin)에서 온 값이어야 한다 — 요청 바디의 이메일로 발급하면
 *   남의 계정 앞으로 코드를 쏟아 발급 상한을 소진시키는 DoS 가 된다.
 */
export async function issueAdminOtp(user: SessionUser): Promise<IssueResult> {
  const payload = await getPayload({ config })

  // 메일이 없는 운영 환경이면 행을 만들기 전에 멈춘다 — 읽을 수 없는 코드로 발급 상한을 소진하지 않는다
  const delivery = otpDelivery(
    Boolean(payload.config.email),
    process.env.NODE_ENV,
    // CI 의 운영 모드 테스트 서버 전용. 실제 배포에는 넣지 않는다(otp-delivery.ts)
    process.env.ALLOW_OTP_IN_SERVER_LOG === '1',
  )
  if (delivery === 'refuse') return { ok: false, reason: 'mail_not_configured' }

  const since =new Date(Date.now() - OTP_ISSUE_WINDOW_MS).toISOString()
  const { totalDocs } = await payload.count({
    collection: 'admin-otps',
    where: { and: [{ user: { equals: user.id } }, { createdAt: { greater_than: since } }] },
    overrideAccess: true,
  })
  if (totalDocs >= OTP_ISSUE_LIMIT) return { ok: false, reason: 'rate_limited' }

  const code = generateOtp()
  const salt = newSalt()
  await payload.create({
    collection: 'admin-otps',
    data: {
      user: user.id,
      hash: hashOtp(code, salt),
      salt,
      expiresAt: new Date(Date.now() + OTP_TTL_MS).toISOString(),
      attempts: 0,
    },
    overrideAccess: true,
  })

  if (delivery === 'log') {
    // 개발 전용. Payload 콘솔 어댑터는 본문을 버리므로 여기서 직접 남긴다
    payload.logger.warn(`[개발용 · 메일 미설정] 관리자 로그인 확인 코드: ${code} (받는 사람 ${user.email}, 10분 유효)`)
    return { ok: true }
  }

  await payload.sendEmail({
    to: user.email,
    subject: '[AYUTA 관리자] 로그인 확인 코드',
    text: `관리자 로그인 확인 코드: ${code}\n\n10분 안에 입력해 주세요. 본인이 요청하지 않았다면 이 메일을 무시하고 비밀번호를 바꿔 주세요.`,
  })
  return { ok: true }
}
