import type { PriceBook, PricingModel, QuoteResult } from './types/index'
import { calculateTier } from './calculators/tier'
import { calculateSum } from './calculators/sum'
import { calculateSumMultiplier } from './calculators/sumMultiplier'
import { calculateInquiry } from './calculators/inquiry'
import { calculateVideoPairs } from './calculators/videoPairs'

const isStringArray = (v: unknown): v is string[] =>
  Array.isArray(v) && v.every((x) => typeof x === 'string')

const asObject = (v: unknown): Record<string, unknown> | null =>
  typeof v === 'object' && v !== null && !Array.isArray(v) ? (v as Record<string, unknown>) : null

const badShape = (field: string): QuoteResult => ({
  ok: false,
  errors: [{ field, message: '선택값이 올바르지 않습니다.' }],
})

/**
 * 모델 종류에 따라 계산기를 고르는 유일한 지점.
 * 폼이 계산기를 직접 고르면 새 카테고리를 넣을 때마다 폼을 고쳐야 한다.
 *
 * 선택값은 클라이언트에서 오므로 모양을 여기서 검증한다. 던지지 않고 거부한다 —
 * 잘못된 입력에 예외가 나면 호출자가 500 을 내고, 그건 공격자에게 주는 정보다.
 */
export function calculate(model: PricingModel, book: PriceBook, sel: unknown): QuoteResult {
  switch (model.kind) {
    case 'tier': {
      const o = asObject(sel)
      if (!o || !isStringArray(o.tiers)) return badShape('tiers')
      const platforms = isStringArray(o.platforms) ? o.platforms : []
      return calculateTier(book, { tiers: o.tiers, platforms })
    }
    case 'sum': {
      const o = asObject(sel)
      if (!o || !isStringArray(o.items)) return badShape('items')
      return calculateSum(book, { items: o.items })
    }
    case 'sumMultiplier': {
      const o = asObject(sel)
      if (!o || !isStringArray(o.items) || typeof o.period !== 'string') return badShape('items')
      return calculateSumMultiplier(book, model.multipliers, { items: o.items, period: o.period }, model.periodLabels)
    }
    case 'videoPairs': {
      const o = asObject(sel)
      if (!o || !Array.isArray(o.pairs)) return badShape('pairs')
      const pairs: { type: string; length: string }[] = []
      for (const p of o.pairs) {
        const po = asObject(p)
        if (!po || typeof po.type !== 'string' || typeof po.length !== 'string') return badShape('pairs')
        pairs.push({ type: po.type, length: po.length })
      }
      return calculateVideoPairs(book, model, { pairs })
    }
    case 'inquiry':
      return calculateInquiry()
  }
}
