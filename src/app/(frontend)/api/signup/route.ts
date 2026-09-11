import { NextResponse } from 'next/server'
import { getPayload } from 'payload'
import config from '@payload-config'
import { z } from 'zod'
import { passwordIssue } from '@/lib/password-policy'

/**
 * 회원가입. Payload 기본 REST(POST /api/users)를 화면에서 쓰지 않고 이 경로를 둔다 —
 * 필수 동의 3종(만 14세·이용약관·개인정보)과 선택 광고 수신을 서버가 확인하고 동의 시각을 서버 시계로 남기기 위해서다.
 * 클라이언트가 보낸 시각을 믿으면 동의 기록이 근거가 못 된다.
 *
 * role 은 받지 않는다(요구사항 1-16 규칙 1). 받지 않을 뿐 아니라, Users 의 beforeValidate 훅이
 * 생성 시 role 을 customer 로 강제한다 — 두 겹이다.
 * 가입만 하고 로그인은 화면이 이어서 /api/users/login 으로 한다(잠금·세션 규칙을 한 곳에 둔다).
 */
const BodySchema = z.object({
  email: z.string().trim().email().max(200),
  // 길이·조합은 아래 passwordIssue 가 본다(weak_password) — 화면과 같은 규칙 파일
  password: z.string().max(1000),
  name: z.string().trim().min(1).max(100),
  phone: z.string().trim().min(1).max(40),
  postalCode: z.string().trim().min(1).max(20),
  address1: z.string().trim().min(1).max(200),
  address2: z.string().trim().max(200).optional().default(''),
  businessNo: z.string().trim().max(20).optional().default(''),
  agreeAge: z.literal(true),
  agreeTerms: z.literal(true),
  agreePrivacy: z.literal(true),
  agreeMarketing: z.boolean().optional().default(false),
})
const CONSENTS = new Set(['agreeAge', 'agreeTerms', 'agreePrivacy'])

export async function POST(req: Request): Promise<Response> {
  let raw: unknown
  try {
    raw = await req.json()
  } catch {
    return NextResponse.json({ error: 'invalid_input' }, { status: 400 })
  }
  const parsed = BodySchema.safeParse(raw)
  if (!parsed.success) {
    const consentMissing = parsed.error.issues.some((i) => CONSENTS.has(String(i.path[0])))
    return NextResponse.json({ error: consentMissing ? 'consent_required' : 'invalid_input' }, { status: 400 })
  }
  const d = parsed.data
  if (passwordIssue(d.password)) return NextResponse.json({ error: 'weak_password' }, { status: 400 })
  const now = new Date().toISOString()

  const payload = await getPayload({ config })
  try {
    await payload.create({
      collection: 'users',
      data: {
        email: d.email.toLowerCase(),
        password: d.password,
        name: d.name,
        phone: d.phone,
        postalCode: d.postalCode,
        address1: d.address1,
        address2: d.address2 || null,
        businessNo: d.businessNo || null,
        // 훅이 어차피 customer 로 강제한다. 타입상 필수라 명시한다
        role: 'customer',
        termsAgreedAt: now,
        privacyAgreedAt: now,
        ageConfirmedAt: now,
        marketingAgreedAt: d.agreeMarketing ? now : null,
      },
      // 동의 시각 필드는 클라이언트 쓰기가 막혀 있어 서버가 overrideAccess 로 쓴다.
      // allowRoleAssignment 는 넘기지 않는다 — role 은 훅이 customer 로 고정한다
      overrideAccess: true,
    })
  } catch {
    // 이미 있는 이메일도 여기로 온다. 가입 여부를 알려주는 것은 계정 존재 오라클이지만,
    // 가입 화면에서는 사용자가 "이미 가입됨"을 알아야 로그인으로 갈 수 있다 — 같은 문구로
    // 두 경우를 묶어 안내한다(email_taken_or_invalid)
    return NextResponse.json({ error: 'signup_failed' }, { status: 400 })
  }
  return NextResponse.json({ ok: true })
}
