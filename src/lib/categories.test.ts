import { describe, expect, it } from 'vitest'
import { CATEGORIES, categoryByNo, categoryBySlug } from './categories'

describe('카테고리 표', () => {
  it('다섯 개가 있고 번호가 1~5로 유일하다', () => {
    expect(CATEGORIES).toHaveLength(5)
    expect(CATEGORIES.map((c) => c.no).sort()).toEqual([1, 2, 3, 4, 5])
  })

  it('슬러그가 서로 겹치지 않는다', () => {
    const slugs = CATEGORIES.map((c) => c.slug)
    expect(new Set(slugs).size).toBe(slugs.length)
  })

  it('슬러그는 URL 에 그대로 쓸 수 있는 형태다', () => {
    for (const c of CATEGORIES) expect(c.slug).toMatch(/^[a-z0-9-]+$/)
  })

  it('1번은 tier 모델이고 5번은 inquiry 모델이다', () => {
    expect(categoryByNo(1)?.model.kind).toBe('tier')
    expect(categoryByNo(5)?.model.kind).toBe('inquiry')
  })

  it('모델의 category 값이 표의 번호와 일치한다', () => {
    // 두 곳이 어긋나면 폼이 다른 카테고리의 계산기를 부른다
    for (const c of CATEGORIES) {
      if ('category' in c.model) expect(c.model.category).toBe(c.no)
    }
  })

  it('없는 슬러그·번호는 null 이다 — 던지지 않는다', () => {
    for (const bad of ['', 'nope', '../etc/passwd', '1']) expect(categoryBySlug(bad)).toBeNull()
    for (const bad of [0, 6, -1, 1.5, NaN]) expect(categoryByNo(bad)).toBeNull()
  })
})
