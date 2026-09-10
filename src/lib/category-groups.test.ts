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
})
