import type { PricingModel } from '@ayuta/pricing'

export type CategoryDef = {
  no: 1 | 2 | 3 | 4 | 5
  slug: string
  model: PricingModel
}

// 표지·1번 폼·서버 액션이 모두 이 표 하나를 본다.
// 세 곳이 각자 카테고리 번호를 하드코딩하면 하나를 고칠 때 나머지가 어긋난다.
export const CATEGORIES: readonly CategoryDef[] = [
  {
    no: 1,
    slug: 'digital-sns',
    model: { kind: 'tier', category: 1, tiers: [], platforms: [] },
  },
  {
    no: 2,
    slug: 'local-video',
    // 2번은 조합형이 아니라 합산이다 — packages/pricing 타입 정정과 짝을 맞춘다
    model: { kind: 'sum', category: 2, groups: [] },
  },
  {
    no: 3,
    slug: 'press-blog',
    model: { kind: 'sum', category: 3, groups: [] },
  },
  {
    no: 4,
    slug: 'transit',
    // 배수는 category-groups.ts의 periods(1w·2w·1m·3m)와 짝이 맞아야 한다 — 여기 없는
    // 기간을 고르면 calculateSumMultiplier가 거부한다. 값 자체는 금액과 마찬가지로
    // 임시값이며 대표님이 확정해야 한다.
    model: { kind: 'sumMultiplier', category: 4, items: [], multipliers: { '1w': 1, '2w': 1.8, '1m': 3, '3m': 8 } },
  },
  {
    no: 5,
    slug: 'other',
    model: { kind: 'inquiry', category: 5 },
  },
]

/**
 * 슬러그로 카테고리를 찾는다. 슬러그는 URL 에서 그대로 온다 —
 * 없으면 null 을 돌려준다. 예외는 500 이 되고 500 은 공격자에게 정보다.
 */
export function categoryBySlug(slug: string): CategoryDef | null {
  return CATEGORIES.find((c) => c.slug === slug) ?? null
}

/** 번호로 카테고리를 찾는다. 던지지 않는다 — 위 categoryBySlug 와 이유가 같다 */
export function categoryByNo(no: number): CategoryDef | null {
  return CATEGORIES.find((c) => c.no === no) ?? null
}
