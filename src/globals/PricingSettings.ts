import type { GlobalConfig, NumberFieldSingleValidation } from 'payload'
import { number } from 'payload/shared'
import { isActiveAdmin, isActiveSuper } from '../lib/admin-access'

/**
 * 가격 계산에 쓰는 설정값 중 단가표(price-entries)에 담을 수 없는 것.
 * 지금은 4번(지하철·버스·블로그) 광고 기간별 배수뿐이다.
 *
 * price-entries 에 섞지 않는 이유: 그쪽 금액 칸은 "정수 최소단위"로 검증된다(1.8 을 넣을 수
 * 없다). 단위가 다른 값을 같은 표에 두면 한쪽 검증을 풀어야 하고, 그 순간 금액 칸에 소수가
 * 들어갈 길이 열린다.
 *
 * 기간 키(1w·2w·1m·3m)는 src/lib/category-groups.ts 의 periods 와 짝이다. 키를 늘리려면
 * 여기 필드와 그쪽 목록, messages/*.json 의 periods 라벨을 함께 바꾼다.
 */
export const PERIOD_KEYS = ['1w', '2w', '1m', '3m'] as const
export type PeriodKey = (typeof PERIOD_KEYS)[number]

// 임시값(대표님 확정 전). 관리자 화면에서 바꾸면 이 기본값은 더 이상 쓰이지 않는다
export const DEFAULT_PERIOD_MULTIPLIERS: Record<PeriodKey, number> = { '1w': 1, '2w': 1.8, '1m': 3, '3m': 8 }

export const MAX_MULTIPLIER = 100

/** 배수 한 칸의 규칙. 화면·API·컬렉션이 같은 판정을 쓰도록 여기 둔다 */
export function multiplierError(value: unknown): string | null {
  if (typeof value !== 'number' || !Number.isFinite(value)) return '배수는 숫자여야 합니다.'
  if (value <= 0) return '배수는 0보다 커야 합니다.'
  if (value > MAX_MULTIPLIER) return `배수는 ${MAX_MULTIPLIER} 이하여야 합니다.`
  // 계산기가 정수 연산(× 100)을 하므로 소수 둘째 자리까지만 받는다
  if (Math.abs(value * 100 - Math.round(value * 100)) > 1e-6) return '배수는 소수 둘째 자리까지만 쓸 수 있습니다.'
  return null
}

// 커스텀 validate 는 Payload 기본 number 검증(required·min)을 대체한다 — 기본 검증을 먼저
// 돌리고 그 위에 규칙을 얹는다(PriceEntries 에서 빈 문자열이 500 을 낸 것과 같은 함정)
const validateMultiplier: NumberFieldSingleValidation = (value, options) => {
  const base = number(value, options)
  if (base !== true) return base
  return multiplierError(value) ?? true
}

export const PricingSettings: GlobalConfig = {
  slug: 'pricing-settings',
  access: {
    // 서버 로더(loadCategoryModel)는 overrideAccess 로 읽는다. REST·GraphQL 로 여는 쪽은
    // 관리자 화면과 같은 게이트(관리자 role)를 탄다
    read: ({ req }) => isActiveAdmin(req),
    // 배수 변경은 곧 가격 변경이다. 단가와 같이 최고관리자만
    update: ({ req }) => isActiveSuper(req),
  },
  fields: [
    {
      name: 'periodMultipliers',
      type: 'group',
      fields: PERIOD_KEYS.map((key) => ({
        name: key,
        type: 'number' as const,
        required: true,
        defaultValue: DEFAULT_PERIOD_MULTIPLIERS[key],
        validate: validateMultiplier,
      })),
    },
  ],
}
