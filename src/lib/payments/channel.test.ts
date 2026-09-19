import { describe, expect, it } from 'vitest'
import { currencyForLocale } from './channel'

describe('통화 결정', () => {
  it('한국어는 원화, 일본어는 엔화', () => {
    expect(currencyForLocale('ko')).toBe('KRW')
    expect(currencyForLocale('ja')).toBe('JPY')
  })

  it('모르는 언어는 원화로 떨어진다', () => {
    expect(currencyForLocale('en')).toBe('KRW')
    expect(currencyForLocale('')).toBe('KRW')
  })
})
