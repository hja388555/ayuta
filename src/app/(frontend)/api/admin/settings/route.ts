import { NextResponse } from 'next/server'
import { z } from 'zod'
import { authedPayload } from '@/lib/admin/orders-data'
import { requireSuperForApi } from '@/lib/admin/require-super'

/**
 * 회사 정보(계약서 을 정보 · 사업자정보 푸터) 저장. 최고관리자만(큐 Q25).
 * 서명·날인 이미지는 별도 경로(/api/admin/settings/seal)가 받는다 — 파일 확인 규칙이 다르다.
 * 이미 체결된 계약서는 주문에 값으로 복사돼 있어 여기서 바꿔도 바뀌지 않는다.
 */
const BodySchema = z
  .object({
    nameKo: z.string().trim().min(1).max(100),
    nameJa: z.string().trim().min(1).max(100),
    ceo: z.string().trim().min(1).max(50),
    businessNo: z.string().trim().min(1).max(30),
    addressKo: z.string().trim().min(1).max(200),
    addressJa: z.string().trim().min(1).max(200),
    phone: z.string().trim().min(1).max(30),
    email: z.string().trim().email().max(200),
    contactPhone: z.string().trim().max(30).optional().default(''),
    mailOrderNo: z.string().trim().max(60).optional().default(''),
  })
  .strict()

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

  try {
    const { payload, user } = await authedPayload()
    await payload.updateGlobal({
      slug: 'company-settings',
      data: { ...d, contactPhone: d.contactPhone || null, mailOrderNo: d.mailOrderNo || null },
      user,
      overrideAccess: false,
    })
    return NextResponse.json({ ok: true })
  } catch {
    return NextResponse.json({ error: 'settings_failed' }, { status: 400 })
  }
}
