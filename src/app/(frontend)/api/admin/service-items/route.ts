import { NextResponse } from 'next/server'
import { z } from 'zod'
import { authedPayload } from '@/lib/admin/orders-data'
import { requireSuperForApi } from '@/lib/admin/require-super'
import { nextItemKey } from '@/lib/services/item-key'

/**
 * 묶음 안 항목 한 줄(선택지)을 만들거나 고친다. 항목은 price-entries 한 행이다 —
 * 단가 관리 화면이 보는 표와 같은 표라, 금액은 두 화면 어디서 고쳐도 같은 곳에 쌓인다.
 *
 * 키는 관리자가 입력하지 않는다. 서버가 nextItemKey 로 만들고 이후 바꾸지 않는다.
 * 금액이 없는 선택지(예: 나라 고르기)는 priced:false 로 두고 단가는 0 으로 저장한다 —
 * 계산기는 priced 인 항목만 더한다.
 */
const Base = z.object({
  labelKo: z.string().trim().min(1).max(100),
  labelJa: z.string().trim().min(1).max(100),
  descKo: z.string().trim().max(500).optional(),
  descJa: z.string().trim().max(500).optional(),
  priceKrw: z.number().int().min(0).max(1_000_000_000),
  priceJpy: z.number().int().min(0).max(1_000_000_000),
  priced: z.boolean(),
  country: z.enum(['kr', 'jp']).optional(),
  exclusive: z.boolean(),
  sortOrder: z.number().int().min(0).max(9999),
  active: z.boolean(),
})

const CreateSchema = Base.extend({ groupId: z.number().int().positive() })
const UpdateSchema = Base.extend({ id: z.number().int().positive() })

export async function POST(req: Request): Promise<Response> {
  const gate = await requireSuperForApi()
  if ('response' in gate) return gate.response

  let raw: unknown
  try {
    raw = await req.json()
  } catch {
    return NextResponse.json({ error: 'invalid_input' }, { status: 400 })
  }

  const isUpdate = typeof (raw as { id?: unknown })?.id === 'number'
  const parsed = isUpdate ? UpdateSchema.safeParse(raw) : CreateSchema.safeParse(raw)
  if (!parsed.success) return NextResponse.json({ error: 'invalid_input' }, { status: 400 })

  try {
    const { payload, user } = await authedPayload()

    if (isUpdate) {
      const { id, ...data } = parsed.data as z.infer<typeof UpdateSchema>
      await payload.update({ collection: 'price-entries', id, data, user, overrideAccess: false })
      return NextResponse.json({ ok: true, id })
    }

    const { groupId, ...rest } = parsed.data as z.infer<typeof CreateSchema>
    const group = await payload.findByID({
      collection: 'ad-service-groups',
      id: groupId,
      depth: 1,
      overrideAccess: true,
    })
    const service = group.service as { id: number; no: number } | number
    if (typeof service === 'number') return NextResponse.json({ error: 'group_failed' }, { status: 400 })

    // 이미 쓰는 키를 피하려면 그 묶음의 항목 전부를 봐야 한다(꺼 둔 항목도 키는 살아 있다)
    const siblings = await payload.find({
      collection: 'price-entries',
      where: { group: { equals: groupId } },
      limit: 500,
      depth: 0,
      overrideAccess: true,
    })
    const key = nextItemKey(
      service.no,
      group.key as string,
      siblings.docs.map((d) => d.key as string),
    )

    const created = await payload.create({
      collection: 'price-entries',
      data: { ...rest, key, group: groupId, category: service.no },
      user,
      overrideAccess: false,
    })
    return NextResponse.json({ ok: true, id: created.id, key })
  } catch {
    return NextResponse.json({ error: 'item_failed' }, { status: 400 })
  }
}
