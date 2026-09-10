import 'server-only'
import { headers } from 'next/headers'
import { getPayload } from 'payload'
import config from '@payload-config'
import { isAdminRole, isSuperRole, type Role } from './roles'
import { verifyOtp } from './admin-otp'
import { hasFreshAdminOtp } from './admin-access'

/** 코드 하나당 허용하는 오답 횟수. 넘으면 정답이어도 더 이상 통과시키지 않는다(fail closed) */
const MAX_OTP_ATTEMPTS = 5

export type SessionUser = { id: number; email: string; role: Role }

/**
 * 인증 실패의 원인을 구분한다.
 * 호출자가 예상된 인증 실패와 진짜 에러(데이터베이스 중단 등)를 구별하려면
 * 이 클래스의 instanceof를 검사한다.
 * 예상 밖의 에러(네트워크 끊김, DB 중단)는 그대로 전파돼 로그에 도달한다.
 */
export class AuthError extends Error {
  constructor(public code: 'UNAUTHENTICATED' | 'FORBIDDEN' | 'OTP_REQUIRED') {
    super(code)
  }
}

/**
 * 2단계 인증이 아직 안 끝난 상태. AuthError 계열이지만 처리는 다르다 —
 * 404가 아니라 /manage/verify로 보내야 한다. instanceof로 구분하고,
 * 문자열 메시지 비교는 쓰지 않는다(모듈 경계를 넘는 문자열 비교는 깨지기 쉽다).
 */
export class OtpRequiredError extends AuthError {
  constructor() {
    super('OTP_REQUIRED')
  }
}

/** 로그인한 사용자를 돌려준다. 없으면 null */
export async function getSessionUser(): Promise<SessionUser | null> {
  const payload = await getPayload({ config })
  const { user } = await payload.auth({ headers: await headers() })
  if (!user) return null
  // 소프트 삭제(탈퇴)된 계정은 세션이 살아 있어도 없는 것으로 취급한다.
  // Payload의 로그인 경로는 deletedAt을 모르므로, 여기서 막지 않으면 탈퇴한
  // 관리자까지 모든 게이트를 그대로 통과한다 — 필드만 있고 강제는 어디에도 없는 상태가 된다.
  // 모든 게이트(requireUser/requireAdmin/requireSuper/requireAdminVerified)가
  // 이 함수를 거치므로 여기 한 곳에서 막으면 전부 닫힌다.
  if (user.deletedAt) return null
  return { id: user.id as number, email: user.email as string, role: user.role as Role }
}

export async function requireUser(): Promise<SessionUser> {
  const user = await getSessionUser()
  if (!user) throw new AuthError('UNAUTHENTICATED')
  return user
}

/** 관리자 화면·API 진입점에서 부른다 */
export async function requireAdmin(): Promise<SessionUser> {
  const user = await requireUser()
  if (!isAdminRole(user.role)) throw new AuthError('FORBIDDEN')
  return user
}

/** 환불 승인 · 단가 수정 · 설정에서 부른다 */
export async function requireSuper(): Promise<SessionUser> {
  const user = await requireUser()
  if (!isSuperRole(user.role)) throw new AuthError('FORBIDDEN')
  return user
}

/**
 * 관리자 화면 진입에는 2단계 인증까지 끝나야 한다.
 * 세션 쿠키에 담지 않고 매 요청 DB에서 확인한다. 쿠키는 조작될 수 있다.
 */
export async function requireAdminVerified(): Promise<SessionUser> {
  const user = await requireAdmin()
  const payload = await getPayload({ config })
  // 판정 자체는 컬렉션 access(isVerifiedAdmin)와 공유한다 — src/lib/admin-access.ts
  //
  // [알려진 한계] 검증 상태가 "세션"이 아니라 "코드를 소비한 시각"에 묶여 있다.
  // 창은 12시간인데 tokenExpiration은 2시간이다. 따라서 12시간 안에 로그아웃
  // 후 다시 로그인하면 2단계 인증 없이 /manage에 들어온다 — 2단계 인증이
  // 실제로 요구되는 것은 대략 여섯 세션 중 한 번뿐이다. 이건 계획대로의 동작이므로
  // 지금 바꾸지 않는다. 올바른 해법은 소비 기록에 세션 id를 같이 저장하고
  // 여기서 현재 세션 id와 일치하는 행만 인정하는 것이며, /manage/verify 화면을
  // 만드는 시점(발급·메일 발송이 붙는 태스크)에 함께 처리한다.
  if (!(await hasFreshAdminOtp(payload, user.id))) throw new OtpRequiredError()
  return user
}

/**
 * OTP 코드를 검증하고 성공 시 즉시 소비한다(consumedAt 기록) — 같은 코드로 재검증이 통과되지 않는다.
 * "코드가 없음"과 "코드가 틀림"을 호출자에게 구분해 주지 않는다: 둘 다 false.
 * 이 차이를 외부에 노출하면 공격자가 지금 유효한 코드가 발급돼 있는지 알아낼 수 있다.
 * /manage/verify 화면(메일 발송 계정 확보 후 구현 예정)이 이 함수를 호출한다.
 *
 * ⚠ 호출 규약 — userId는 반드시 세션에서 뽑아야 한다.
 *   호출자는 userId를 requireUser()(= 쿠키/JWT로 검증된 세션)에서만 가져와야 하며,
 *   요청 바디·쿼리스트링 등 클라이언트 입력에서 받아서는 절대 안 된다. 입력을 그대로
 *   넘기는 순간 이 함수는 "남의 계정에 대해 코드를 찍어보는 오라클"이 된다 —
 *   공격자가 임의의 userId로 6자리를 시도할 수 있게 되고, 아래의 per-record 시도 캡은
 *   공격자 본인이 아니라 피해자 계정의 코드를 소진시키는 DoS 수단으로도 쓰인다.
 *
 * ⚠ 발급 측 규약 — 재발송(resend)이 생기면 여기의 시도 캡만으로는 부족하다.
 *   MAX_OTP_ATTEMPTS는 "코드 한 건당" 5회다. "재발송" 버튼이 붙는 순간
 *   5회 × 무제한 재발송으로 10^6 공간이 그대로 브루트포스된다(기대 20만 회 재발송이면
 *   자동화로 충분히 도달 가능). 따라서 발급 쪽에서 "사용자당 · 시간창당" 발급 횟수를
 *   반드시 제한해야 하며, 그 제한이 없는 상태로 재발송 UI를 붙이면 안 된다.
 */
export async function verifyAndConsumeAdminOtp(userId: number, input: string): Promise<boolean> {
  const payload = await getPayload({ config })
  const { docs } = await payload.find({
    collection: 'admin-otps',
    where: {
      and: [{ user: { equals: userId } }, { consumedAt: { exists: false } }],
    },
    sort: '-createdAt',
    limit: 1,
    overrideAccess: true,
  })
  const record = docs[0]
  if (!record) return false // 발급된 코드가 없어도 "틀림"과 같은 결과를 돌려준다

  // 시도를 먼저 원자적으로 예약(attempts+1)한 뒤에만 비교한다.
  // update가 비교 이후였다면: (a) update 자체가 실패해도 시도는 이미 공짜로 소비됐고,
  // (b) 동시 요청 두 개가 같은 attempts 값을 읽어 캡을 두 배로 우회할 수 있었다.
  // "먼저 예약, 그다음 비교"로 두 문제를 하나의 원자적 UPDATE로 없앤다.
  const reserve = await payload.db.pool.query(
    `UPDATE admin_otps SET attempts = attempts + 1
     WHERE id = $1 AND attempts < $2 AND consumed_at IS NULL
     RETURNING attempts`,
    [record.id, MAX_OTP_ATTEMPTS],
  )
  // rowCount가 null일 수 있는 드라이버 동작에 대비해 ?? 0으로 좁힌다.
  // null을 그대로 === 0과 비교하면 false가 되어 "예약 성공"으로 흘러가 fail open이 된다.
  // 아래 consume 검사와 같은 방향(fail closed)으로 맞춘다.
  if ((reserve.rowCount ?? 0) === 0) return false // 캡 소진 또는 이미 소비됨 — 값을 비교조차 하지 않는다

  const expiresAt = new Date(record.expiresAt)
  if (Number.isNaN(expiresAt.getTime())) return false // 파싱 실패를 "만료 안 됨"으로 흘려보내지 않는다

  const result = verifyOtp(input, record.hash, record.salt, expiresAt, new Date())
  if (result !== 'ok') return false

  // 소비도 compare-and-swap: 아직 안 쓰인 경우에만 갱신한다.
  // 0행이면 동시 요청이 먼저 소비했다는 뜻 — 같은 코드가 두 번 통과하지 않는다.
  const consume = await payload.db.pool.query(
    `UPDATE admin_otps SET consumed_at = now() WHERE id = $1 AND consumed_at IS NULL RETURNING id`,
    [record.id],
  )
  return (consume.rowCount ?? 0) > 0
}
