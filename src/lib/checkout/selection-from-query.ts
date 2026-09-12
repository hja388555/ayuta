import type { CategoryForm } from '../category-groups'
import type { PricingModel } from '@ayuta/pricing'

type SearchParams = Record<string, string | string[] | undefined>

const asArray = (v: string | string[] | undefined): string[] => (v === undefined ? [] : Array.isArray(v) ? v : [v])

/**
 * 견적 폼이 쿼리스트링에 담아 넘긴 선택을, 서버가 재계산할 selection 모양으로 되돌린다.
 * 이전 화면(TierForm/GroupForm)의 buildPaymentQuery/buildGroupQuery 와 짝을 이룬다 —
 * 저기서 만든 쿼리를 여기서 그대로 복원한다.
 */
export function selectionFromQuery(model: PricingModel, sp: SearchParams): unknown {
  // size는 금액에 관여하지 않는 자유 입력(GroupForm.buildGroupQuery가 담아 보낸다)이지만
  // 계약서 항목(국가/사이즈 등)에는 들어가야 한다 — calculate()로 가는 selection과 계약서
  // 사실(facts)로 가는 selection이 같은 값이어야 나중에 둘이 따로 놀지 않는다.
  const size = typeof sp.size === 'string' ? sp.size : undefined
  // 표지(cover)에서 넘어온 나라·목적. 가격에 관여하지 않지만 "뭘 파는지"를 설명하는
  // 값이라 카테고리와 무관하게 항상 selection에 실어 둔다 — calculate() 호출 직전에서만
  // (filterPricedSelection이 아니라 registry.calculate 자체가 쓰지 않는 키를 무시한다)
  // 걸러지고, 계약서·주문 저장에는 그대로 남는다.
  const country = asArray(sp.country)
  const purpose = typeof sp.purpose === 'string' ? sp.purpose : undefined
  switch (model.kind) {
    case 'tier':
      return { tiers: asArray(sp.tier), platforms: asArray(sp.platform), country, purpose }
    case 'sum':
      return { items: asArray(sp.item), size, country, purpose }
    case 'videoPairs':
      // item= 에는 촬영 국가(금액 없음)만 온다. 금액은 pair=종류:길이 로만 계산한다
      return { items: asArray(sp.item), pairs: pairsFromQuery(model, sp), country, purpose }
    case 'sumMultiplier':
      return { items: asArray(sp.item), period: typeof sp.period === 'string' ? sp.period : '', size, country, purpose }
    case 'inquiry':
      return { country, purpose }
  }
}

/**
 * 2번 쿼리 `pair=video-type-company:video-length-10m`(반복)을 쌍 목록으로 되돌린다.
 * 모양이 틀린 값은 버리지 않고 빈 길이로 남긴다 — 계산기가 통째로 거부해야 고객이 고른 것과
 * 다른 금액이 조용히 청구되지 않는다.
 *
 * 옛 주소(단일 선택 시절 `item=영상종류&item=영상길이`, pair 없음)는 종류 하나·길이 하나일 때만
 * 같은 금액의 쌍 하나로 바꿔 받는다. 그 밖의 옛 조합은 쌍이 비어 계산이 거부되고 결제 화면이 404 가 된다.
 */
export function pairsFromQuery(
  model: Extract<PricingModel, { kind: 'videoPairs' }>,
  sp: SearchParams,
): { type: string; length: string }[] {
  const raw = asArray(sp.pair)
  if (raw.length > 0) {
    return raw.map((v) => {
      const i = v.indexOf(':')
      return i < 0 ? { type: v, length: '' } : { type: v.slice(0, i), length: v.slice(i + 1) }
    })
  }
  const items = asArray(sp.item)
  const types = items.filter((k) => model.types.includes(k))
  const lengths = items.filter((k) => model.lengths.includes(k))
  return types.length === 1 && lengths.length === 1 ? [{ type: types[0]!, length: lengths[0]! }] : []
}

/**
 * 계산기에 넘길 항목은 금액칸이 있는 것만이다 — 국가 선택처럼 priced:false 인 항목을
 * 그대로 넣으면 "단가 없음"으로 통째로 거부된다 (GroupForm.pricedKeys 와 같은 필터).
 * tier 모델은 book 에 있는 등급만 고를 수 있어 이 필터가 필요 없다.
 */
export function filterPricedSelection(model: PricingModel, form: CategoryForm | null, selection: unknown): unknown {
  // 2번은 쌍만 계산기로 간다 — 촬영 국가(items)는 계약서·주문 메모에만 남는다
  if (model.kind === 'videoPairs') {
    const pairs = typeof selection === 'object' && selection !== null ? (selection as { pairs?: unknown }).pairs : undefined
    return { pairs }
  }
  if (model.kind !== 'sum' && model.kind !== 'sumMultiplier') return selection
  if (!form || typeof selection !== 'object' || selection === null) return selection
  const sel = selection as { items?: unknown; period?: unknown }
  if (!Array.isArray(sel.items)) return selection

  const pricedKeys = new Set(form.groups.flatMap((g) => g.items.filter((i) => i.priced).map((i) => i.key)))
  const items = sel.items.filter((k): k is string => typeof k === 'string' && pricedKeys.has(k))
  return model.kind === 'sumMultiplier' ? { items, period: sel.period } : { items }
}
