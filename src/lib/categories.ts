import type { PricingModel } from '@ayuta/pricing'
import { formFor } from './category-groups'

export type CategoryDef = {
  no: 1 | 2 | 3 | 4 | 5
  slug: string
  model: PricingModel
}

const groupKeys = (no: number, group: string): string[] =>
  formFor(no)?.groups.find((g) => g.key === group)?.items.map((i) => i.key) ?? []

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
    // 2번은 고른 영상 종류마다 길이를 하나씩 붙인 (종류 + 길이) 쌍의 합이다(2026-09-12).
    // 종류·길이 키 목록은 화면 정의(category-groups.ts)에서 읽는다 — 단가 시드와 같은 출처다
    model: { kind: 'videoPairs', category: 2, types: groupKeys(2, 'videoType'), lengths: groupKeys(2, 'videoLength') },
  },
  {
    no: 3,
    slug: 'press-blog',
    model: { kind: 'sum', category: 3, groups: [] },
  },
  {
    no: 4,
    slug: 'transit',
    // 기간 배수는 여기 두지 않는다 — 관리자가 고치는 값이라 DB(pricing-settings global)에 있고,
    // loadCategoryModel()(src/lib/pricing-model.ts)이 요청마다 채운다. 일부러 비워 둔다:
    // 로더를 거치지 않고 이 모델을 그대로 계산에 쓰면 옛 임시값으로 조용히 청구하는 대신
    // "기간을 선택해 주세요"로 막힌다.
    model: { kind: 'sumMultiplier', category: 4, items: [], multipliers: {} },
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
