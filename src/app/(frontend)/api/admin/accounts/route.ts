import { NextResponse } from 'next/server'
import { getPayload } from 'payload'
import config from '@payload-config'
import { z } from 'zod'
import { requireSuperForApi } from '@/lib/admin/require-super'

/**
 * 관리자 계정 생성 — 최고관리자만(요구사항 1-16 규칙 2: 권한 변경은 super 만).
 * 대표님이 관리자 계정 2개(최고관리자 1 · 중간관리자 1)를 만들 경로다. 회원가입 화면은 role 을
 * 받지 않으므로, 관리자 권한이 붙은 계정은 이 경로(또는 seed 스크립트)로만 생긴다.
 * 비밀번호는 10자 이상 — 2단계 인증이 없으니(2026-09-11 결정) 비밀번호가 유일한 방어선이다.
 */
const BodySchema = z.object({
  email: z.string().trim().email().max(200),
  name: z.string().trim().min(1).max(100),
  password: z.string().min(10).max(128),
  role: z.enum(['manager', 'super']),
  phone: z.string().trim().max(40).optional().default(''),
})

export async function POST(req: Request): Promise<Response> {
  const gate = await requireSuperForApi()
  if ('response' in gate) return gate.response

  let raw: unknown
  try {
    raw = await req.json()
  } catch {
    return NextResponse.json({ error: 'invalid_input' }, { status: 400 })
  }
  const parsed = BodySchema.safeParse(raw)
  if (!parsed.success) return NextResponse.json({ error: 'invalid_input' }, { status: 400 })
  const d = parsed.data

  const payload = await getPayload({ config })
  try {
    const created = await payload.create({
      collection: 'users',
      data: {
        email: d.email.toLowerCase(),
        name: d.name,
        password: d.password,
        role: d.role,
        // 고객용 필수 항목. 관리자 계정은 주소를 쓰지 않는다
        phone: d.phone || '-',
        postalCode: '-',
        address1: '-',
      },
      overrideAccess: true,
      // role 을 실제로 심으려면 훅의 명시적 탈출구가 필요하다 — HTTP 바디로는 설정할 수 없는 값이다
      context: { allowRoleAssignment: true },
    })
    return NextResponse.json({ ok: true, userId: created.id })
  } catch {
    return NextResponse.json({ error: 'account_failed' }, { status: 400 })
  }
}
