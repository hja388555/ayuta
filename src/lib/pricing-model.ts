import 'server-only'
import { getPayload } from 'payload'
import config from '@payload-config'
import type { PricingModel } from '@ayuta/pricing'
import type { CategoryDef } from './categories'
import { multiplierError, PERIOD_KEYS } from '../globals/PricingSettings'

/**
 * 카테고리 정의(categories.ts)의 계산 모델에 관리자가 DB 에 저장한 값을 채운다.
 * 지금 채우는 값은 4번 기간 배수뿐이다(pricing-settings global).
 *
 * 견적 화면·결제 화면·주문 생성이 모두 이 함수를 거친다 — 한 곳이라도 categories.ts 의
 * 모델을 그대로 쓰면 미리보기와 청구 금액이 갈라진다. 캐시하지 않는다: 관리자가 저장한
 * 값이 다음 요청부터 바로 반영돼야 한다(loadPriceBook 과 같은 판단).
 */
export async function loadCategoryModel(def: CategoryDef): Promise<PricingModel> {
  if (def.model.kind !== 'sumMultiplier') return def.model

  const payload = await getPayload({ config })
  const settings = await payload.findGlobal({ slug: 'pricing-settings', overrideAccess: true, depth: 0 })
  const stored = (settings?.periodMultipliers ?? {}) as Partial<Record<string, unknown>>

  const multipliers: Record<string, number> = {}
  for (const key of PERIOD_KEYS) {
    const value = stored[key]
    // 저장된 값이 규칙을 어기면 멈춘다. 모르는 값을 1 로 떨어뜨리면 고객이 3개월을 고르고
    // 1주 값을 낸다 — 잘못된 견적을 주느니 견적을 막는 게 낫다(loadPriceBook 과 같은 판단)
    const err = multiplierError(value)
    if (err) throw new Error(`pricing-settings.periodMultipliers.${key}: ${err}`)
    multipliers[key] = value as number
  }
  return { ...def.model, multipliers }
}
