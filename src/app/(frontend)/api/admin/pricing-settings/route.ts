import { NextResponse } from 'next/server'
import { z } from 'zod'
import { authedPayload } from '@/lib/admin/orders-data'
import { requireSuperVerifiedForApi } from '@/lib/admin/require-super-verified'
import { multiplierError, PERIOD_KEYS } from '@/globals/PricingSettings'

/**
 * 4번 광고 기간별 배수를 고친다. 관리자 단가 화면(/manage/prices)이 부른다.
 * 네 기간을 한 번에 받는다 — 일부만 받으면 화면에서 나머지가 무엇으로 저장됐는지 헷갈린다.
 * 저장된 값은 다음 견적·주문부터 바로 쓰인다(loadCategoryModel 은 캐시하지 않는다).
 * 이미 만들어진 주문은 금액을 값으로 저장해 두었으므로 바뀌지 않는다.
 */
const BodySchema = z.object({
  periodMultipliers: z.object(
    Object.fromEntries(PERIOD_KEYS.map((k) => [k, z.number()])) as Record<(typeof PERIOD_KEYS)[number], z.ZodNumber>,
  ).strict(),
})

export async function POST(req: Request): Promise<Response> {
  const gate = await requireSuperVerifiedForApi()
  if ('response' in gate) return gate.response

  let raw: unknown
  try {
    raw = await req.json()
  } catch {
    return NextResponse.json({ error: 'invalid_input' }, { status: 400 })
  }
  const parsed = BodySchema.safeParse(raw)
  if (!parsed.success) return NextResponse.json({ error: 'invalid_input' }, { status: 400 })

  // 전역 validate 도 같은 규칙으로 막지만, 여기서 먼저 걸러 어떤 기간이 틀렸는지 400 으로 돌려준다
  const { periodMultipliers } = parsed.data
  for (const key of PERIOD_KEYS) {
    if (multiplierError(periodMultipliers[key])) {
      return NextResponse.json({ error: 'invalid_multiplier', field: key }, { status: 400 })
    }
  }

  try {
    const { payload, user } = await authedPayload()
    await payload.updateGlobal({
      slug: 'pricing-settings',
      data: { periodMultipliers },
      user,
      overrideAccess: false,
    })
    return NextResponse.json({ ok: true })
  } catch {
    return NextResponse.json({ error: 'settings_failed' }, { status: 400 })
  }
}
