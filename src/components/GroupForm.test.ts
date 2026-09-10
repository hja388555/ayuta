import { describe, expect, it } from 'vitest'
import { minor, type PriceBook, type PricingModel } from '@ayuta/pricing'
import { buildGroupQuery, pricedKeys, previewGroupTotal } from './GroupForm'
import type { CategoryForm } from '@/lib/category-groups'

// 3번 모양(합산, 기간 없음)
const sumBook: PriceBook = {
  currency: 'KRW',
  entries: {
    'national-kr-hankyung': { key: 'national-kr-hankyung', label: '한국경제 신문', amount: minor(800_000) },
    'national-kr-donga': { key: 'national-kr-donga', label: '동아일보', amount: minor(800_000) },
  },
}
const sumModel: PricingModel = { kind: 'sum', category: 3, groups: [] }
const sumForm: CategoryForm = {
  groups: [
    {
      key: 'national',
      multi: true,
      items: [
        { key: 'national-kr-hankyung', priced: true },
        { key: 'national-kr-donga', priced: true },
      ],
    },
  ],
}

// 4번 모양(합산 + 기간 배수, 별도문의 그룹)
const multBook: PriceBook = {
  currency: 'KRW',
  entries: {
    'subway-city-seoul': { key: 'subway-city-seoul', label: '서울', amount: minor(1_000_000) },
    'subway-spot-door-side': { key: 'subway-spot-door-side', label: '차량 문옆', amount: minor(500_000) },
  },
}
const multModel: PricingModel = {
  kind: 'sumMultiplier',
  category: 4,
  items: [],
  multipliers: { '1w': 1, '2w': 1.5, '1m': 2 },
}
const multForm: CategoryForm = {
  groups: [
    {
      key: 'subwayCity',
      multi: false,
      items: [{ key: 'subway-city-seoul', priced: true }],
    },
    {
      key: 'subwaySpot',
      multi: true,
      items: [{ key: 'subway-spot-door-side', priced: true }],
    },
    {
      key: 'posterBillboard',
      multi: false,
      items: [
        { key: 'poster-make-inquiry', priced: false },
        { key: 'poster-skip', priced: false },
      ],
    },
  ],
  periods: ['1w', '2w', '1m'],
  freeText: [{ key: 'size', maxLength: 10 }],
}

describe('priced 항목 추출', () => {
  it('priced:false 항목(국가, 별도문의)은 걸러낸다', () => {
    const selections = { subwayCity: ['subway-city-seoul'], posterBillboard: ['poster-make-inquiry'] }
    expect(pricedKeys(multForm, selections)).toEqual(['subway-city-seoul'])
  })

  it('선택이 없으면 빈 배열이다', () => {
    expect(pricedKeys(sumForm, {})).toEqual([])
  })
})

describe('묶음 폼 미리보기', () => {
  it('고른 항목이 합산된다', () => {
    const total = previewGroupTotal(sumBook, sumModel, ['national-kr-hankyung', 'national-kr-donga'])
    expect(total).toBe(1_600_000)
  })

  it('기간을 고르면 배수가 적용된다 (4번)', () => {
    const items = ['subway-city-seoul', 'subway-spot-door-side']
    expect(previewGroupTotal(multBook, multModel, items, '1w')).toBe(1_500_000)
    expect(previewGroupTotal(multBook, multModel, items, '2w')).toBe(2_250_000)
  })

  it('아무것도 안 고르면 0을 보여준다 — 던지지 않는다', () => {
    expect(previewGroupTotal(sumBook, sumModel, [])).toBe(0)
  })

  it('단가에 없는 항목이 섞이면 0을 보여준다', () => {
    expect(previewGroupTotal(sumBook, sumModel, ['national-kr-hankyung', 'ghost'])).toBe(0)
  })

  it('4번에서 기간을 고르지 않으면 0을 보여준다', () => {
    expect(previewGroupTotal(multBook, multModel, ['subway-city-seoul'], undefined)).toBe(0)
  })
})

describe('결제 쿼리', () => {
  it('고른 항목과 기간이 반복 파라미터로 들어간다', () => {
    const qs = buildGroupQuery(['subway-city-seoul', 'subway-spot-door-side'], '1w', undefined, 10)
    const params = new URLSearchParams(qs)
    expect(params.getAll('item')).toEqual(['subway-city-seoul', 'subway-spot-door-side'])
    expect(params.get('period')).toBe('1w')
  })

  it('금액 키(total·amount·price·sum)가 절대 들어가지 않는다', () => {
    const qs = buildGroupQuery(['national-kr-hankyung'], undefined, undefined, 10)
    expect(qs).not.toMatch(/\b(total|amount|price|sum)\b/)
  })

  it('자유 입력(사이즈)은 길이 상한을 넘기면 잘린다', () => {
    const qs = buildGroupQuery([], undefined, '01234567890123456789', 10)
    const params = new URLSearchParams(qs)
    expect(params.get('size')).toBe('0123456789')
  })

  it('빈 선택이면 빈 쿼리다', () => {
    expect(buildGroupQuery([], undefined, undefined, 10)).toBe('')
  })

  it('빈 문자열/공백만 있는 사이즈는 쿼리에 담지 않는다', () => {
    const qs = buildGroupQuery([], undefined, '   ', 10)
    expect(qs).toBe('')
  })

  it('표지에서 고른 나라·목적을 그대로 실어 보낸다', () => {
    const qs = buildGroupQuery(['subway-city-seoul'], '1w', undefined, 10, ['jp', 'kr'], 'store')
    const params = new URLSearchParams(qs)
    expect(params.getAll('country')).toEqual(['jp', 'kr'])
    expect(params.get('purpose')).toBe('store')
  })
})
