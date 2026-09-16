import { NextResponse } from 'next/server'
import { z } from 'zod'
import { authedPayload } from '@/lib/admin/orders-data'
import { requireSuperForApi } from '@/lib/admin/require-super'

/**
 * 광고 서비스의 묶음 한 줄을 만들거나 고친다(주문 화면의 한 단계 = 묶음).
 * 관리자 광고 서비스 편집 화면(/manage/services/[id])이 부른다.
 *
 * 묶음 키(key)는 만들 때만 정하고 이후 못 바꾼다 — 단가 행이 묶음을 이 이름으로 가리킨다.
 * 서비스(service)도 옮기지 못한다. 옮기면 그 묶음에 달린 항목들이 다른 서비스 화면에 나타난다.
 */
const CreateSchema = z.object({
  serviceId: z.number().int().positive(),
  key: z
    .string()
    .trim()
    .min(1)
    .max(40)
    .regex(/^[a-z][a-zA-Z0-9]*$/, '영문 소문자로 시작하는 영문·숫자만'),
  titleKo: z.string().trim().min(1).max(100),
  titleJa: z.string().trim().min(1).max(100),
  hintKo: z.string().trim().max(200).optional(),
  hintJa: z.string().trim().max(200).optional(),
  multi: z.boolean(),
  countryTabs: z.boolean(),
  axis: z.enum(['none', 'type', 'length']),
  sortOrder: z.number().int().min(0).max(9999),
  active: z.boolean(),
})

// 고칠 때는 키·서비스를 받지 않는다 — 보내도 무시하는 게 아니라 아예 모양에서 뺀다
const UpdateSchema = CreateSchema.omit({ serviceId: true, key: true }).extend({
  id: z.number().int().positive(),
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

  const isUpdate = typeof (raw as { id?: unknown })?.id === 'number'
  const parsed = isUpdate ? UpdateSchema.safeParse(raw) : CreateSchema.safeParse(raw)
  if (!parsed.success) return NextResponse.json({ error: 'invalid_input' }, { status: 400 })

  try {
    const { payload, user } = await authedPayload()

    if (isUpdate) {
      const { id, ...data } = parsed.data as z.infer<typeof UpdateSchema>
      await payload.update({ collection: 'ad-service-groups', id, data, user, overrideAccess: false })
      return NextResponse.json({ ok: true, id })
    }

    const { serviceId, ...rest } = parsed.data as z.infer<typeof CreateSchema>
    // 같은 서비스 안에서 묶음 키가 겹치면 조회가 둘 중 하나만 집는다
    const dup = await payload.find({
      collection: 'ad-service-groups',
      where: { and: [{ service: { equals: serviceId } }, { key: { equals: rest.key } }] },
      limit: 1,
      depth: 0,
      overrideAccess: true,
    })
    if (dup.docs.length > 0) return NextResponse.json({ error: 'group_key_taken' }, { status: 400 })

    const created = await payload.create({
      collection: 'ad-service-groups',
      data: { ...rest, service: serviceId },
      user,
      overrideAccess: false,
    })
    return NextResponse.json({ ok: true, id: created.id })
  } catch {
    return NextResponse.json({ error: 'group_failed' }, { status: 400 })
  }
}
