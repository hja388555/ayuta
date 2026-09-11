import { describe, expect, it } from 'vitest'
import { formFor } from './category-groups'

describe('카테고리 폼 정의', () => {
  it('2·3·4번에 정의가 있고 1·5번에는 없다', () => {
    for (const n of [2, 3, 4]) expect(formFor(n)).not.toBeNull()
    // 1번은 전용 폼(TierForm), 5번은 문의라 그룹 폼을 쓰지 않는다
    expect(formFor(1)).toBeNull()
    expect(formFor(5)).toBeNull()
  })

  it('없는 번호는 null 이다 — 던지지 않는다', () => {
    for (const bad of [0, 6, -1, 1.5, NaN]) expect(formFor(bad)).toBeNull()
  })

  it('항목 키가 카테고리 안에서 유일하다', () => {
    for (const n of [2, 3, 4]) {
      const keys = formFor(n)!.groups.flatMap((g) => g.items.map((i) => i.key))
      expect(new Set(keys).size).toBe(keys.length)
    }
  })

  it('항목 키에 `__` 가 없다', () => {
    // 단가 키 규칙(PriceEntries.key validate)과 같은 제약을 여기서도 지킨다
    for (const n of [2, 3, 4]) {
      for (const g of formFor(n)!.groups) for (const i of g.items) expect(i.key).not.toContain('__')
    }
  })

  it('4번에만 기간이 있다', () => {
    expect(formFor(4)!.periods).toBeDefined()
    expect(formFor(2)!.periods).toBeUndefined()
    expect(formFor(3)!.periods).toBeUndefined()
  })

  it('4번의 사이즈는 자유 입력이고 금액이 붙지 않는다', () => {
    const f = formFor(4)!
    expect(f.freeText?.some((t) => t.key === 'size')).toBe(true)
    // 자유 입력은 계산에 들어가지 않는다
    const priced = f.groups.flatMap((g) => g.items).filter((i) => i.priced)
    expect(priced.every((i) => i.key !== 'size')).toBe(true)
  })

  it('자유 입력에는 길이 상한이 있다', () => {
    for (const t of formFor(4)!.freeText ?? []) expect(t.maxLength).toBeGreaterThan(0)
  })

  it('4번 포스터·전광판 제작은 금액이 붙는 항목이다 (Figma v2 — 별도문의 폐지)', () => {
    const poster = formFor(4)!.groups.find((g) => g.key === 'posterBillboard')!
    expect(poster.items.map((i) => i.key)).toEqual([
      'poster-make-inquiry',
      'poster-skip',
      'poster-video-image',
      'poster-digital',
    ])
    expect(poster.items.every((i) => i.priced)).toBe(true)
  })

  it('3·4번은 한국/일본 탭을 쓰고, 도시·매체 항목은 한쪽 나라에만 속한다', () => {
    for (const n of [3, 4]) expect(formFor(n)!.countryTabs).toBe(true)
    expect(formFor(2)!.countryTabs).toBeUndefined()
    const cities = formFor(4)!.groups.filter((g) => g.key.endsWith('City')).flatMap((g) => g.items)
    expect(cities.every((i) => i.country === 'kr' || i.country === 'jp')).toBe(true)
    for (const n of [3, 4]) {
      for (const g of formFor(n)!.groups) {
        const kr = g.items.filter((i) => i.country === 'kr').length
        const jp = g.items.filter((i) => i.country === 'jp').length
        // 나라별로 나뉜 그룹이면 탭마다 같은 수의 도시가 보인다(3열 카드 배치)
        if (g.key.endsWith('City')) expect(kr).toBe(jp)
      }
    }
    expect(formFor(3)!.groups.find((g) => g.key === 'blog')!.items.every((i) => i.country === 'jp')).toBe(true)
  })
})
