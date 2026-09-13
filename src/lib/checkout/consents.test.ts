import { describe, expect, it } from 'vitest'
import { allRequiredChecked, consentsFor, withBaseConsents } from './consents'

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

describe('기본 동의(이용약관·개인정보) 항상 포함', () => {
  it('템플릿 동의 앞에 이용약관 · 개인정보 두 줄을 필수로 붙인다', () => {
    const template = [{ key: 'contract', label: '계약 내용에 동의합니다.', required: true }]
    const result = withBaseConsents(template, 'ko')
    expect(result.map((d) => d.key)).toEqual(['terms', 'privacy', 'contract'])
    expect(result[0]).toEqual({ key: 'terms', label: '서비스 이용 약관에 동의 합니다.', required: true })
    expect(result[1]).toEqual({ key: 'privacy', label: '개인정보 수집 이용에 동의 합니다.', required: true })
  })

  it('일본어 화면은 일본어 문구를 쓴다', () => {
    const result = withBaseConsents([], 'ja')
    expect(result.map((d) => d.key)).toEqual(['terms', 'privacy'])
  })

  it('템플릿이 이미 terms·privacy 를 갖고 있으면 중복으로 붙이지 않는다', () => {
    const template = [
      { key: 'terms', label: '기존 이용약관 문구', required: true },
      { key: 'contract', label: '계약 내용에 동의합니다.', required: true },
    ]
    const result = withBaseConsents(template, 'ko')
    expect(result.map((d) => d.key)).toEqual(['terms', 'privacy', 'contract'])
    // 기존 템플릿 문구를 덮어쓰지 않는다
    expect(result[0]?.label).toBe('기존 이용약관 문구')
  })
})
