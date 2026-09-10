import type { Payload, PayloadRequest } from 'payload'
import { isAdminRole, isSuperRole } from './roles'

/** 2단계 인증 한 번이 유효한 시간. 알려진 한계는 dal.ts requireAdminVerified 주석 참고 */
export const OTP_WINDOW_MS = 12 * 60 * 60 * 1000

/**
 * 이 사용자가 최근 OTP_WINDOW_MS 안에 2단계 인증 코드를 소비했는가.
 * requireAdminVerified(화면·전용 API 게이트)와 컬렉션 access(REST·GraphQL·/admin)가
 * 같은 판정을 쓰도록 한 곳에 둔다 — 둘이 갈라지면 한쪽이 우회로가 된다.
 * `server-only` 를 붙이지 않는다: 컬렉션 설정이 import 한다.
 */
export async function hasFreshAdminOtp(payload: Payload, userId: number, req?: PayloadRequest): Promise<boolean> {
  const { docs } = await payload.find({
    collection: 'admin-otps',
    where: {
      and: [
        { user: { equals: userId } },
        { consumedAt: { exists: true } },
        { consumedAt: { greater_than: new Date(Date.now() - OTP_WINDOW_MS).toISOString() } },
      ],
    },
    limit: 1,
    depth: 0,
    overrideAccess: true,
    // 트랜잭션 안에서 불리면 같은 연결을 써야 한다 — 따로 잡으면 풀 고갈·교착 위험
    req,
  })
  return docs.length > 0
}

const CACHE_KEY = 'adminOtpVerified'

/**
 * 컬렉션 access 용: 관리자 role + 2단계 인증 완료.
 * role 만 보면 OTP 를 거치지 않은 세션이 Payload REST(/api/orders 등)·GraphQL·/admin 으로
 * 고객 개인정보와 계약서 전문을 그대로 읽는다 — /manage 게이트를 옆으로 돌아가는 길이다.
 * 한 요청 안에서 access 가 여러 번 불리므로 결과를 req.context 에 한 번만 계산해 둔다.
 */
export async function isVerifiedAdmin(req: PayloadRequest): Promise<boolean> {
  const user = req.user as { id?: unknown; role?: unknown; deletedAt?: unknown } | null | undefined
  if (!user || !isAdminRole(user.role) || user.deletedAt) return false
  const cached = req.context?.[CACHE_KEY]
  if (typeof cached === 'boolean') return cached
  const ok = await hasFreshAdminOtp(req.payload, user.id as number, req)
  if (req.context) req.context[CACHE_KEY] = ok
  return ok
}

export async function isVerifiedSuper(req: PayloadRequest): Promise<boolean> {
  return isSuperRole(req.user?.role) && (await isVerifiedAdmin(req))
}
