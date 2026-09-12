import { NextResponse } from 'next/server'
import { APIError, getPayload, jwtSign } from 'payload'
import config from '@payload-config'
import { z } from 'zod'
import { loginSessionPlan } from '@/lib/login-session'

/**
 * 로그인(요구사항 1-16) + "로그인 상태 유지".
 *
 * 비밀번호 확인·5회 실패 10분 잠금·세션 생성·관리자 로그인 기록은 Payload 로그인(payload.login)이 그대로 한다.
 * 그 결과는 언제나 기본 길이(Users.auth.tokenExpiration, 2시간)의 세션·토큰이다. 유지를 고르면 여기서
 * 방금 만든 세션(users.sessions 의 sid 행) 만료를 늘리고 같은 클레임으로 토큰을 다시 서명한다.
 * 기본값을 길게 두고 줄이는 방식이 아니다 — 그러면 이 경로를 거치지 않는 /api/users/login 이 30일 토큰을 내준다.
 *
 * 만료 강제는 두 겹이다: JWT exp(jose 가 검증) + 세션 expiresAt(Users afterRead 훅이 만료 세션을 걸러 JWT 전략이 거절).
 * 쿠키 수명은 편의일 뿐이다 — 유지 안 함은 세션 쿠키(브라우저 종료 시 삭제), 유지는 Max-Age = 세션 길이.
 */
const BodySchema = z.object({
  email: z.string().max(320),
  password: z.string().max(128),
  keep: z.boolean().optional(),
})

const failed = (status: number) => NextResponse.json({ error: 'login_failed' }, { status })

export async function POST(req: Request): Promise<Response> {
  // 다른 사이트의 폼 전송(text/plain 등)으로 로그인시키는 걸 막는다 — application/json 은 교차 출처면 preflight 가 필요하다
  if (!req.headers.get('content-type')?.toLowerCase().startsWith('application/json')) {
    return NextResponse.json({ error: 'invalid_input' }, { status: 415 })
  }
  let raw: unknown
  try {
    raw = await req.json()
  } catch {
    return NextResponse.json({ error: 'invalid_input' }, { status: 400 })
  }
  const parsed = BodySchema.safeParse(raw)
  if (!parsed.success) return NextResponse.json({ error: 'invalid_input' }, { status: 400 })
  const { email, password, keep = false } = parsed.data

  const payload = await getPayload({ config })
  let result
  try {
    // headers 를 넘겨야 afterLogin 훅이 관리자 로그인 IP·User-Agent 를 남긴다
    result = await payload.login({ collection: 'users', data: { email, password }, req: { headers: req.headers } })
  } catch (err) {
    // 없는 계정·틀린 비밀번호·잠김·빈 값을 구분해 알려주지 않는다
    if (err instanceof APIError && err.status < 500) return failed(401)
    throw err
  }
  const { token, user } = result
  if (!token || !user) return failed(401)

  const plan = loginSessionPlan({ role: user.role, keep })
  let cookieToken = token
  if (keep) {
    const claims = decodeClaims(token)
    const sid = typeof claims.sid === 'string' ? claims.sid : null
    if (!sid) throw new Error('로그인 토큰에 sid 가 없다(Users.auth.useSessions 확인)')
    const { iat: _iat, exp: _exp, ...fieldsToSign } = claims
    const signed = await jwtSign({ fieldsToSign, secret: payload.secret, tokenExpiration: plan.seconds })
    await extendSession(payload, user.id as number, sid, new Date(signed.exp * 1000))
    cookieToken = signed.token
  }

  const authConfig = payload.collections.users.config.auth
  const sameSite = typeof authConfig.cookies.sameSite === 'string' ? authConfig.cookies.sameSite : authConfig.cookies.sameSite ? 'Strict' : 'Lax'
  const res = NextResponse.json({ user: { id: user.id, email: user.email, role: user.role } })
  // 이름·경로·도메인은 Payload generatePayloadCookie 와 같게 — 로그아웃(generateExpiredPayloadCookie)이 같은 쿠키를 지운다
  res.cookies.set(`${payload.config.cookiePrefix}-token`, cookieToken, {
    httpOnly: true,
    path: '/',
    domain: authConfig.cookies.domain ?? undefined,
    sameSite: sameSite.toLowerCase() as 'lax' | 'strict' | 'none',
    secure: Boolean(authConfig.cookies.secure) || sameSite === 'None' || process.env.NODE_ENV === 'production',
    ...(plan.cookieMaxAge ? { maxAge: plan.cookieMaxAge } : {}),
  })
  return res
}

/** 방금 서버가 서명한 토큰이라 검증 없이 클레임만 읽는다 */
function decodeClaims(token: string): Record<string, unknown> {
  return JSON.parse(Buffer.from(token.split('.')[1] ?? '', 'base64url').toString('utf8'))
}

type PayloadInstance = Awaited<ReturnType<typeof getPayload>>

/**
 * users.sessions 의 한 행 만료만 바꾼다. Payload 의 addSessionToUser·refreshOperation 과 같은 방식
 * (db.findOne → 배열 수정 → db.updateOne, updatedAt 은 건드리지 않음)이라 훅·접근 규칙을 타지 않는다.
 */
async function extendSession(payload: PayloadInstance, userId: number, sid: string, expiresAt: Date) {
  const doc = await payload.db.findOne<{ id: number; sessions?: unknown }>({ collection: 'users', where: { id: { equals: userId } } })
  const sessions = Array.isArray(doc?.sessions) ? (doc.sessions as { id: string; expiresAt: unknown }[]) : []
  if (!doc || !sessions.some((s) => s.id === sid)) throw new Error('방금 만든 로그인 세션을 찾지 못했다')
  await payload.db.updateOne({
    collection: 'users',
    id: userId,
    data: { ...doc, updatedAt: null, sessions: sessions.map((s) => (s.id === sid ? { ...s, expiresAt } : s)) },
    returning: false,
  })
}
