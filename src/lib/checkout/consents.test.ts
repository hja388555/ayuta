import { describe, expect, it } from 'vitest'
import { allRequiredChecked, consentsFor } from './consents'

describe('동의 항목', () => {
  it('1·2번은 1개, 4번은 3개다', () => {
    expect(consentsFor(1)).toHaveLength(1)
    expect(consentsFor(2)).toHaveLength(1)
    expect(consentsFor(4)).toHaveLength(3)
  })

  it('필수 항목이 하나라도 빠지면 거짓이다', () => {
    const defs = consentsFor(4)
    const allButOne = Object.fromEntries(defs.slice(0, -1).map((d) => [d.key, true]))
    expect(allRequiredChecked(defs, allButOne)).toBe(false)

    const all = Object.fromEntries(defs.map((d) => [d.key, true]))
    expect(allRequiredChecked(defs, all)).toBe(true)
  })

  it('정의에 없는 키를 체크해도 통과시키지 않는다', () => {
    const defs = consentsFor(1)
    expect(allRequiredChecked(defs, { 무관한키: true })).toBe(false)
  })

  it('없는 카테고리는 빈 배열이다 — 던지지 않는다', () => {
    expect(consentsFor(3)).toEqual([])
    expect(consentsFor(5)).toEqual([])
    expect(consentsFor(99)).toEqual([])
    // 빈 정의에 아무 체크가 없어도(필수 없음) 통과한다
    expect(allRequiredChecked(consentsFor(3), {})).toBe(true)
  })
})
