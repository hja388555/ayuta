import 'server-only'
import { getPayload } from 'payload'
import config from '@payload-config'
import { generateOtp, hashOtp, newSalt } from '@/lib/admin-otp'
import type { SessionUser } from '@/lib/dal'

/** 코드 유효 시간. 메일을 열어 입력하기까지 충분하고, 새어 나가도 오래 못 쓰는 길이 */
export const OTP_TTL_MS = 10 * 60 * 1000

/**
 * 사용자당·시간창당 발급 상한. dal.ts verifyAndConsumeAdminOtp 주석의 발급 측 규약이다 —
 * 시도 캡(코드 한 건당 5회)만 있으면 "재발송"을 반복해 10^6 공간을 전수 대입할 수 있다.
 * 1시간 5건 × 5회 = 25회/시간 → 한 코드를 맞힐 확률이 사실상 0 이 된다.
 */
export const OTP_ISSUE_LIMIT = 5
export const OTP_ISSUE_WINDOW_MS = 60 * 60 * 1000

export type IssueResult = { ok: true } | { ok: false; reason: 'rate_limited' }

/**
 * 관리자 2단계 인증 코드를 발급하고 보낸다. 코드는 해시로만 저장하고 응답에 싣지 않는다.
 *
 * 발송은 payload.sendEmail 로 한다. 메일 어댑터가 아직 없으면(메일 계정 수령 전, Q28)
 * Payload 가 메일 내용을 서버 콘솔에 찍는다 — 개발 중에는 그 로그로 코드를 확인한다.
 * 운영에서도 어댑터가 없으면 코드가 서버 로그에 남으므로, 운영 오픈 전에 반드시 어댑터를 붙인다.
 *
 * ⚠ user 는 반드시 세션(requireAdmin)에서 온 값이어야 한다 — 요청 바디의 이메일로 발급하면
 *   남의 계정 앞으로 코드를 쏟아 발급 상한을 소진시키는 DoS 가 된다.
 */
export async function issueAdminOtp(user: SessionUser): Promise<IssueResult> {
  const payload = await getPayload({ config })

  const since = new Date(Date.now() - OTP_ISSUE_WINDOW_MS).toISOString()
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

  await payload.sendEmail({
    to: user.email,
    subject: '[AYUTA 관리자] 로그인 확인 코드',
    text: `관리자 로그인 확인 코드: ${code}\n\n10분 안에 입력해 주세요. 본인이 요청하지 않았다면 이 메일을 무시하고 비밀번호를 바꿔 주세요.`,
  })
  return { ok: true }
}
