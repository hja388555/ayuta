import { CATEGORIES } from '../categories'
import { formFor, type GroupDef, type ItemDef } from '../category-groups'
import { PERIOD_KEYS } from '../../globals/PricingSettings'

/**
 * 코드 상수(categories.ts · category-groups.ts)를 DB 행 모양으로 바꾼다(2026-09-16).
 *
 * 시드 스크립트가 이 결과를 그대로 심는다. 순수 함수다 — DB 도, Payload 도 모른다.
 * 그래야 "상수와 DB 가 같은 구조인가"를 서버 없이 테스트로 붙잡을 수 있다.
 *
 * 금액과 라벨은 여기서 만들지 않는다. 이미 price-entries 에 있고, 시드는 그 행을 키로 찾아
 * 묶음 연결만 채운다 — 여기서 새로 만들면 같은 항목이 두 벌이 된다.
 */
export type SeedItem = {
  key: string
  priced: boolean
  country?: 'kr' | 'jp'
  exclusive: boolean
  sortOrder: number
}

export type SeedGroup = {
  key: string
  multi: boolean
  countryTabs: boolean
  axis: 'none' | 'type' | 'length'
  sortOrder: number
  items: SeedItem[]
}

export type SeedService = {
  no: number
  slug: string
  model: 'tier' | 'sum' | 'sumMultiplier' | 'videoPairs' | 'inquiry'
  contractMode: 'fixed' | 'perQuote'
  sortOrder: number
  periods?: { key: string; multiplier: number }[]
  groups: SeedGroup[]
}

// 1번(등급형)은 묶음 정의가 category-groups.ts 에 없다 — 등급 표와 플랫폼 목록이 화면 문구
// (messages 의 tierForm)에 있기 때문이다. 2026-09-16 사용자 결정에 따라 등급·플랫폼만 DB 로 옮긴다.
// 등급은 중복 선택이고 금액을 합산한다(calculators/tier.ts). 플랫폼은 금액에 영향이 없다.
const TIER_GROUPS: SeedGroup[] = [
  {
    key: 'platform',
    multi: true,
    countryTabs: false,
    axis: 'none',
    sortOrder: 10,
    items: ['instagram', 'youtube', 'tiktok', 'line'].map((key, i) => ({
      key,
      priced: false,
      exclusive: false,
      sortOrder: (i + 1) * 10,
    })),
  },
  {
    key: 'tier',
    multi: true,
    countryTabs: false,
    axis: 'none',
    sortOrder: 20,
    items: ['basic', 'standard', 'premium'].map((key, i) => ({
      key,
      priced: true,
      exclusive: false,
      sortOrder: (i + 1) * 10,
    })),
  },
]

// 2번 영상은 "종류 × 길이" 쌍으로 계산한다. 어느 묶음이 어느 축인지는 계산 모델이 들고 있던
// 정보라 묶음 행에도 남겨야 한다 — 없으면 새 서비스에서 같은 계산을 못 만든다
const axisOf = (groupKey: string): SeedGroup['axis'] => {
  if (groupKey === 'videoType') return 'type'
  if (groupKey === 'videoLength') return 'length'
  return 'none'
}

const toItem = (item: ItemDef, index: number): SeedItem => ({
  key: item.key,
  priced: item.priced,
  ...(item.country ? { country: item.country } : {}),
  exclusive: item.exclusive === true,
  sortOrder: (index + 1) * 10,
})

const toGroup = (group: GroupDef, index: number, countryTabs: boolean): SeedGroup => ({
  key: group.key,
  multi: group.multi,
  // 한국/일본 탭은 카테고리 단위 설정이지만, 실제로 나뉘는 건 나라 값을 가진 항목이 있는 묶음뿐이다
  countryTabs: countryTabs && group.items.some((i) => i.country),
  axis: axisOf(group.key),
  sortOrder: (index + 1) * 10,
  items: group.items.map(toItem),
})

export function servicesFromConstants(): SeedService[] {
  return CATEGORIES.map((def, index) => {
    const form = formFor(def.no)
    const groups =
      def.model.kind === 'tier'
        ? TIER_GROUPS
        : (form?.groups ?? []).map((g, i) => toGroup(g, i, form?.countryTabs === true))
    return {
      no: def.no,
      slug: def.slug,
      model: def.model.kind,
      // 5번은 문의를 받고 관리자가 견적을 발행한다 — 계약서도 그때 쓴다(2026-09-14 결정)
      contractMode: def.model.kind === 'inquiry' ? 'perQuote' : 'fixed',
      sortOrder: (index + 1) * 10,
      // 배수 값은 관리자가 저장한 값(pricing-settings)이라 시드 실행 때 채운다
      ...(def.model.kind === 'sumMultiplier' ? { periods: PERIOD_KEYS.map((key) => ({ key, multiplier: 0 })) } : {}),
      groups,
    }
  })
}
