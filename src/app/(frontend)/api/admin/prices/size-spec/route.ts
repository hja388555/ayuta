import { NextResponse } from 'next/server'
import { z } from 'zod'
import { authedPayload } from '@/lib/admin/orders-data'
import { requireSuperForApi } from '@/lib/admin/require-super'
import { MAX_PRICE_AMOUNT } from '@/lib/admin/price-limits'
import { SIZE_SPEC_KEYS } from '@/lib/category-groups'

/**
 * 4번 사이즈 규격 5칸(size-spec-1~5) 전용 저장 — 이름·단가를 한 번에 만들거나 고친다(4라운드 F).
 * 일반 단가 API(/api/admin/prices)는 라벨을 못 바꾼다(키 고정 원칙) — 이 다섯 칸만은
 * 관리자가 처음부터 이름을 정해야 해서(시드에 안 심는다) 별도 경로로 라벨까지 받는다.
 * key 는 다섯 개로 고정한다 — 다른 키를 받으면 계산기가 모르는 항목이 늘어난다.
 */
const BodySchema = z.object({
  key: z.enum(SIZE_SPEC_KEYS),
  labelKo: z.string().trim().min(1).max(100),
  labelJa: z.string().trim().min(1).max(100),
  priceKrw: z.number().int().min(0),
  priceJpy: z.number().int().min(0),
  active: z.boolean(),
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

  const { key, labelKo, labelJa, priceKrw, priceJpy, active } = parsed.data
  if (priceKrw > MAX_PRICE_AMOUNT || priceJpy > MAX_PRICE_AMOUNT) {
    return NextResponse.json({ error: 'price_too_large' }, { status: 400 })
  }

  try {
    const { payload, user } = await authedPayload()
    const { docs } = await payload.find({
      collection: 'price-entries',
      where: { key: { equals: key } },
      limit: 1,
      depth: 0,
      user,
      overrideAccess: false,
    })
    const existing = docs[0]
    if (existing) {
      await payload.update({
        collection: 'price-entries',
        id: existing.id,
        data: { labelKo, labelJa, priceKrw, priceJpy, active },
        user,
        overrideAccess: false,
      })
    } else {
      await payload.create({
        collection: 'price-entries',
        data: { key, category: 4, labelKo, labelJa, priceKrw, priceJpy, active },
        user,
        overrideAccess: false,
      })
    }
    return NextResponse.json({ ok: true })
  } catch {
    return NextResponse.json({ error: 'price_failed' }, { status: 400 })
  }
}
