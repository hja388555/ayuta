import { NextResponse } from 'next/server'
import { z } from 'zod'
import { authedPayload } from '@/lib/admin/orders-data'
import { requireSuperForApi } from '@/lib/admin/require-super'
import { nextServiceNo, serviceSlug } from '@/lib/services/new-service'

/**
 * 광고 서비스 한 줄을 만들거나 고친다.
 * 관리자 광고 서비스 화면(/manage/services, /manage/services/[id])이 부른다.
 *
 * Payload REST 를 화면에서 직접 부르지 않는 이유는 단가 라우트와 같다 — 응답 규약과 에러
 * 번역표를 관리자 API 하나로 맞추고, 바꿀 수 있는 필드를 여기서 명시적으로 좁힌다.
 *
 * 번호(no)·주소(slug)는 만들 때 서버가 정하고 이후 못 바꾼다. 계산 방식(model)도 만든 뒤
 * 못 바꾼다 — 셋 다 이미 받은 주문·계약서·단가가 서로를 찾는 이름이고, 계산 방식을 바꾸면
 * 옛 주문과 금액이 어긋난다.
 * 저장은 overrideAccess 없이 세션 사용자로 한다 — 컬렉션 access(isActiveSuper)를 한 번 더 탄다.
 */
const Editable = z.object({
  nameKo: z.string().trim().min(1).max(100),
  nameJa: z.string().trim().min(1).max(100),
  descKo: z.string().trim().max(200).optional(),
  descJa: z.string().trim().max(200).optional(),
  contractMode: z.enum(['fixed', 'perQuote']),
  sortOrder: z.number().int().min(0).max(9999),
  active: z.boolean(),
})

const UpdateSchema = Editable.extend({ id: z.number().int().positive() })
// 만들 때만 계산 방식을 고른다. 고칠 때는 모양에서 아예 뺀다
const CreateSchema = Editable.extend({
  model: z.enum(['tier', 'sum', 'sumMultiplier', 'videoPairs', 'inquiry']),
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
      await payload.update({ collection: 'ad-services', id, data, user, overrideAccess: false })
      return NextResponse.json({ ok: true, id })
    }

    // 번호·주소는 기존 행 전부를 봐야 정할 수 있다. 꺼 둔 서비스의 번호도 다시 쓰지 않는다
    const all = await payload.find({ collection: 'ad-services', limit: 500, depth: 0, overrideAccess: true })
    const no = nextServiceNo(all.docs.map((d) => d.no as number))
    const data = parsed.data as z.infer<typeof CreateSchema>
    const slug = serviceSlug(data.nameKo, no, all.docs.map((d) => d.slug as string))

    const created = await payload.create({
      collection: 'ad-services',
      data: { ...data, no, slug },
      user,
      overrideAccess: false,
    })
    return NextResponse.json({ ok: true, id: created.id, no, slug })
  } catch {
    // 없는 id·검증 실패·권한 거부가 모두 여기로 온다. 구분해 알려주지 않는다
    return NextResponse.json({ error: 'service_failed' }, { status: 400 })
  }
}
