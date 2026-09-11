import { NextResponse } from 'next/server'
import { z } from 'zod'
import { authedPayload } from '@/lib/admin/orders-data'
import { requireSuperForApi } from '@/lib/admin/require-super'
import { unknownPlaceholders } from '@/lib/legal/placeholders'

/**
 * 계약서·이용약관·개인정보처리방침 문구 저장. 최고관리자만(큐 Q25 2차).
 * 이미 체결된 계약서는 주문에 원문이 복사돼 있어(orders.contractText) 여기서 바꿔도 바뀌지 않는다.
 * 저장할 때마다 legal-revisions 에 이력이 남는다(컬렉션 훅).
 */
const Text = { title: z.string().trim().min(1).max(200), body: z.string().min(1).max(50_000) }
const BodySchema = z.discriminatedUnion('target', [
  z.object({ target: z.literal('contract'), id: z.number().int().positive(), ...Text }).strict(),
  z.object({ target: z.literal('document'), kind: z.enum(['terms', 'privacy']), locale: z.enum(['ko', 'ja']), ...Text }).strict(),
])

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

  // 채울 수 없는 빈칸이 있으면 그 상품 주문이 전부 막힌다 — 저장 전에 거절한다
  if (d.target === 'contract') {
    const unknown = unknownPlaceholders(d.body)
    if (unknown.length > 0) return NextResponse.json({ error: 'unknown_placeholder', detail: unknown }, { status: 400 })
  }

  try {
    const { payload, user } = await authedPayload()
    if (d.target === 'contract') {
      await payload.update({ collection: 'contract-templates', id: d.id, data: { title: d.title, body: d.body }, user, overrideAccess: false })
      return NextResponse.json({ ok: true })
    }
    const { docs } = await payload.find({
      collection: 'legal-documents',
      where: { and: [{ kind: { equals: d.kind } }, { locale: { equals: d.locale } }] },
      limit: 1,
      overrideAccess: true,
    })
    if (docs[0]) {
      await payload.update({ collection: 'legal-documents', id: docs[0].id, data: { title: d.title, body: d.body }, user, overrideAccess: false })
    } else {
      await payload.create({ collection: 'legal-documents', data: { kind: d.kind, locale: d.locale, title: d.title, body: d.body }, user, overrideAccess: false })
    }
    return NextResponse.json({ ok: true })
  } catch {
    return NextResponse.json({ error: 'legal_failed' }, { status: 400 })
  }
}
