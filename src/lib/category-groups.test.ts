import { describe, expect, it } from 'vitest'
import { formFor, SIZE_SPEC_KEYS } from './category-groups'

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

  it('4번은 자유 입력 사이즈칸이 없다(6라운드) — 관리자 규격(sizeSpec) 선택만 받는다', () => {
    const f = formFor(4)!
    expect(f.freeText).toBeUndefined()
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

  it('4번 사이즈 규격 5칸(size-spec)은 자유 입력 다음의 별도 묶음이고, form.groups 시드 대상에는 없다(4라운드 F)', () => {
    const f = formFor(4)!
    expect(f.sizeSpecs?.map((s) => s.key)).toEqual([...SIZE_SPEC_KEYS])
    expect(SIZE_SPEC_KEYS.length).toBe(5)
    // 시드 스크립트(scripts/seed-prices.ts)는 form.groups 의 priced 키만 읽는다 —
    // sizeSpecs 가 groups 에 섞여 있으면 시드가 다섯 칸을 미리 채워 "비어 있어야 한다" 규칙이 깨진다
    const groupKeys = new Set(f.groups.flatMap((g) => g.items.map((i) => i.key)))
    for (const k of SIZE_SPEC_KEYS) expect(groupKeys.has(k)).toBe(false)
  })
})
