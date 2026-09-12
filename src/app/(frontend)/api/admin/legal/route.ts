import { NextResponse } from 'next/server'
import { z } from 'zod'
import { authedPayload } from '@/lib/admin/orders-data'
import { requireSuperForApi } from '@/lib/admin/require-super'
import { issueField } from '@/lib/admin/issue-field'
import { unknownPlaceholders } from '@/lib/legal/placeholders'
import { defaultAgreeConsent } from '@/lib/legal/contract-defaults'

/**
 * 계약서·이용약관·개인정보처리방침·환불 및 취소 정책 문구 저장. 최고관리자만(큐 Q25 2차).
 * 이미 체결된 계약서는 주문에 원문이 복사돼 있어(orders.contractText) 여기서 바꿔도 바뀌지 않는다.
 * 저장할 때마다 legal-revisions 에 이력이 남는다(컬렉션 훅).
 *
 * 계약서 동의 체크박스(3차)는 문구만 고친다. 항목 key·개수·필수 여부는 결제 검증(createOrder 의
 * allRequiredChecked)과 화면이 함께 기대하는 구조라, 문구 수정 화면에서 바꾸게 두지 않는다.
 */
const Text = { title: z.string().trim().min(1).max(200), body: z.string().min(1).max(50_000) }
const ConsentLabel = z.object({ key: z.string().min(1).max(50), label: z.string().trim().min(1).max(300) }).strict()
const BodySchema = z.discriminatedUnion('target', [
  z.object({ target: z.literal('contract'), id: z.number().int().positive(), ...Text, consents: z.array(ConsentLabel).max(20).optional() }).strict(),
  z.object({ target: z.literal('document'), kind: z.enum(['terms', 'privacy', 'refund']), locale: z.enum(['ko', 'ja']), ...Text }).strict(),
  // 아직 없는 계약서(예: 5번 기타 광고 — 고정 원문이 없다)를 관리자가 문구를 넣어 처음 만든다(2026-09-11 사용자 결정 A).
  // 만들면 바로 게시(active)되고, 그 상품의 결제(견적 결제 포함)가 열린다
  z.object({ target: z.literal('contract-new'), category: z.number().int().min(1).max(5), locale: z.enum(['ko', 'ja']), ...Text, consents: z.array(ConsentLabel).max(20).optional() }).strict(),
])

type StoredConsent = { key: string; label: string; required: boolean }

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
  // 어느 칸이 틀렸는지(field)만 알려준다. 스키마 내부 메시지는 싣지 않는다
  if (!parsed.success) return NextResponse.json({ error: 'invalid_input', ...issueField(parsed.error) }, { status: 400 })
  const d = parsed.data

  // 채울 수 없는 빈칸이 있으면 그 상품 주문이 전부 막힌다 — 저장 전에 거절한다
  if (d.target === 'contract' || d.target === 'contract-new') {
    const unknown = unknownPlaceholders(d.body)
    if (unknown.length > 0) return NextResponse.json({ error: 'unknown_placeholder', detail: unknown }, { status: 400 })
  }

  try {
    const { payload, user } = await authedPayload()
    if (d.target === 'contract-new') {
      const { docs } = await payload.find({
        collection: 'contract-templates',
        where: { and: [{ category: { equals: d.category } }, { locale: { equals: d.locale } }] },
        limit: 1,
        depth: 0,
        overrideAccess: true,
      })
      // 이미 있으면 새로 만들지 않는다 — 그사이 다른 관리자가 만들었으면 그 문서를 고쳐야 한다
      if (docs[0]) return NextResponse.json({ error: 'contract_exists', id: docs[0].id }, { status: 409 })
      const base = defaultAgreeConsent(d.locale)
      const incoming = d.consents
      if (incoming && (incoming.length !== 1 || incoming[0]!.key !== base.key)) return NextResponse.json({ error: 'consent_keys_mismatch' }, { status: 400 })
      const created = await payload.create({
        collection: 'contract-templates',
        data: { category: d.category, locale: d.locale, title: d.title, body: d.body, consents: [{ ...base, label: incoming?.[0]?.label ?? base.label }], active: true },
        user,
        overrideAccess: false,
      })
      return NextResponse.json({ ok: true, id: created.id })
    }
    if (d.target === 'contract') {
      let consents: StoredConsent[] | undefined
      const incoming = d.consents
      if (incoming) {
        const current = await payload.findByID({ collection: 'contract-templates', id: d.id, depth: 0, overrideAccess: true })
        const existing = ((current.consents ?? []) as StoredConsent[]).map(({ key, label, required }) => ({ key, label, required }))
        // 같은 key 가 같은 순서로 와야 한다 — 다른 사람이 그사이 구성을 바꿨거나 조작된 요청이다
        const sameShape = existing.length === incoming.length && existing.every((c, i) => c.key === incoming[i]!.key)
        if (!sameShape) return NextResponse.json({ error: 'consent_keys_mismatch' }, { status: 400 })
        consents = existing.map((c, i) => ({ ...c, label: incoming[i]!.label }))
      }
      await payload.update({
        collection: 'contract-templates',
        id: d.id,
        data: { title: d.title, body: d.body, ...(consents ? { consents } : {}) },
        user,
        overrideAccess: false,
      })
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
