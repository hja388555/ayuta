import { describe, expect, it } from 'vitest'
import { buildCoverQuery, canProceedToService, formatCountries, sanitizeCountries } from './cover-selection'

describe('표지 나라 선택', () => {
  it('나라가 없으면 서비스 카드로 이동할 수 없다', () => {
    expect(canProceedToService([])).toBe(false)
  })

  it('나라를 하나라도 고르면 이동할 수 있다', () => {
    expect(canProceedToService(['jp'])).toBe(true)
  })

  it('목적은 이 판단에 관여하지 않는다 — 나라만 필수다', () => {
    // 목적 값이 canProceedToService 시그니처에 아예 없다는 사실 자체가 계약이지만,
    // 회귀 방지로 나라만 있어도 통과함을 명시한다
    expect(canProceedToService(['kr'])).toBe(true)
  })
})

describe('sanitizeCountries', () => {
  it('알 수 없는 값은 버린다', () => {
    expect(sanitizeCountries(['jp', 'us', 'kr'])).toEqual(['jp', 'kr'])
  })
})

describe('buildCoverQuery', () => {
  it('허락된 선택 키만 담는다 — country, purpose만 들어간다', () => {
    const qs = buildCoverQuery(['jp', 'kr'], 'brand')
    const params = new URLSearchParams(qs)
    const allKeys = new Set(params.keys())
    // 허락된 키는 정확히 이것들만이다
    const permittedKeys = new Set(['country', 'purpose'])
    expect(allKeys).toEqual(permittedKeys)
  })

  it('나라를 repeated param으로, 목적을 단일 값으로 담는다', () => {
    const qs = new URLSearchParams(buildCoverQuery(['jp', 'kr'], 'brand'))
    expect(qs.getAll('country')).toEqual(['jp', 'kr'])
    expect(qs.get('purpose')).toBe('brand')
  })

  it('목적이 없으면 purpose 키를 아예 안 담는다 — 목적은 선택이다', () => {
    const qs = new URLSearchParams(buildCoverQuery(['jp'], undefined))
    expect(qs.has('purpose')).toBe(false)
  })
})

describe('formatCountries — 계약서 광고 국가 줄', () => {
  it('둘 다 고르면 원본 표기 순서(한국, 일본)로 찍는다', () => {
    expect(formatCountries(['jp', 'kr'], 'ko')).toBe('한국, 일본')
  })

  it('하나만 고르면 그것만 찍는다', () => {
    expect(formatCountries(['jp'], 'ko')).toBe('일본')
    expect(formatCountries(['kr'], 'ko')).toBe('한국')
  })

  it('일본어 로케일은 일본어 라벨로 찍는다', () => {
    expect(formatCountries(['jp', 'kr'], 'ja')).toBe('韓国, 日本')
  })
})
