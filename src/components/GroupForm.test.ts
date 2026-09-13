import { describe, expect, it } from 'vitest'
import { minor, type PriceBook, type PricingModel } from '@ayuta/pricing'
import { buildGroupQuery, countryColumns, dropOtherCountries, initialCountries, initialSelections, nextSelection, pricedKeys, previewGroupTotal, toggleCountry } from './GroupForm'
import { formFor } from '../lib/category-groups'
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

// 4번 모양(합산 + 기간 배수). 금액 없는 그룹은 가상의 픽스처 — priced:false 거르기 검증용
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
  it('priced:false 항목(국가 등)은 걸러낸다', () => {
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

  it('허락된 선택 키만 담는다 — item, period, size, country, purpose만 들어간다', () => {
    const qs = buildGroupQuery(['subway-city-seoul'], '1w', '10cm', 10, ['kr', 'jp'], ['store'])
    const params = new URLSearchParams(qs)
    const allKeys = new Set(params.keys())
    // 허락된 키는 정확히 이것들만이다
    const permittedKeys = new Set(['item', 'period', 'size', 'country', 'purpose'])
    expect(allKeys).toEqual(permittedKeys)
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
    const qs = buildGroupQuery(['subway-city-seoul'], '1w', undefined, 10, ['jp', 'kr'], ['store'])
    const params = new URLSearchParams(qs)
    expect(params.getAll('country')).toEqual(['jp', 'kr'])
    expect(params.getAll('purpose')).toEqual(['store'])
  })
})


describe('중복 선택과 혼자만 고르는 항목(2026-09-12)', () => {
  const poster = { key: 'posterBillboard', multi: true, items: [{ key: 'a', priced: true }, { key: 'skip', priced: true, exclusive: true as const }, { key: 'b', priced: true }] }
  it('중복 그룹은 여러 개를 켜고 끈다', () => {
    expect(nextSelection(poster, ['a'], 'b')).toEqual(['a', 'b'])
    expect(nextSelection(poster, ['a', 'b'], 'a')).toEqual(['b'])
  })
  it('혼자만 고르는 항목을 고르면 나머지를 비우고, 다른 항목을 고르면 그 항목이 빠진다', () => {
    expect(nextSelection(poster, ['a', 'b'], 'skip')).toEqual(['skip'])
    expect(nextSelection(poster, ['skip'], 'a')).toEqual(['a'])
  })
  it('단일 그룹은 하나만 남는다', () => {
    const single = { ...poster, multi: false }
    expect(nextSelection(single, ['a'], 'b')).toEqual(['b'])
    expect(nextSelection(single, ['b'], 'b')).toEqual([])
  })
  it('4번 지하철·버스 도시와 포스터는 중복 선택이다', () => {
    const f = formFor(4)!
    for (const key of ['subwayCity', 'subwaySpot', 'posterBillboard', 'busCity', 'busSpot']) expect(f.groups.find((g) => g.key === key)?.multi).toBe(true)
  })
})

describe('표지 광고 국가 적용(2026-09-12)', () => {
  it('2번 촬영 국가 묶음을 표지 선택으로 미리 체크한다', () => {
    const f = formFor(2)!
    expect(initialSelections(f, ['jp'])).toEqual({ country: ['country-jp'] })
    expect(initialSelections(f, ['kr', 'jp'])).toEqual({ country: ['country-kr', 'country-jp'] })
    expect(initialSelections(f, [])).toEqual({})
  })
})

describe('한국/일본 체크와 나라 열 (2026-09-13)', () => {
  const form = formFor(3)!
  it('표지에서 고른 나라로 시작하고, 없으면 둘 다', () => {
    expect(initialCountries(['jp'])).toEqual(['jp'])
    expect(initialCountries(['jp', 'kr'])).toEqual(['kr', 'jp'])
    expect(initialCountries([])).toEqual(['kr', 'jp'])
  })
  it('나라를 끄면 그 나라 항목이 선택에서 빠진다', () => {
    const r = toggleCountry(['kr', 'jp'], 'jp', form, { national: ['national-kr-donga', 'national-jp-yomiuri'], blog: ['blog-note'] })
    expect(r.countries).toEqual(['kr'])
    expect(r.selections).toEqual({ national: ['national-kr-donga'], blog: [] })
  })
  it('마지막 남은 나라는 끌 수 없다', () => {
    const r = toggleCountry(['kr'], 'kr', form, {})
    expect(r.countries).toEqual(['kr'])
  })
  it('나라 항목 묶음은 고른 나라마다 열, 블로그(일본만)는 일본을 고르면 한 열', () => {
    const national = form.groups.find((g) => g.key === 'national')!
    expect(countryColumns(national, ['kr', 'jp']).map((c) => c.country)).toEqual(['kr', 'jp'])
    expect(countryColumns(national, ['jp'])[0]!.items.every((i) => i.country === 'jp')).toBe(true)
    const blog = form.groups.find((g) => g.key === 'blog')!
    expect(countryColumns(blog, ['kr'])).toEqual([])
  })
  it('나라 없는 묶음(4번 광고 위치)은 열 하나', () => {
    const spot = formFor(4)!.groups.find((g) => g.key === 'subwaySpot')!
    expect(countryColumns(spot, ['kr'])).toEqual([{ country: null, items: spot.items }])
  })
  it('되살릴 때 체크 안 된 나라의 항목은 뺀다 — 손으로 고친 country=kr 에 item=일본 항목이 섞여도 몰래 합산되지 않는다', () => {
    const restored = { national: ['national-kr-donga', 'national-jp-yomiuri'], blog: ['blog-note'] }
    expect(dropOtherCountries(form, restored, ['kr'])).toEqual({ national: ['national-kr-donga'], blog: [] })
    expect(dropOtherCountries(form, restored, ['kr', 'jp'])).toEqual(restored)
  })
  it('나라 체크가 없는 폼(2번)은 그대로 둔다', () => {
    const f = formFor(2)!
    const sel = { country: ['country-kr'] }
    expect(dropOtherCountries(f, sel, ['kr'])).toEqual(sel)
  })
})
