import { describe, expect, it } from 'vitest'
import { localeFromCountry, localeFromPath } from './geo'

describe('localeFromCountry', () => {
  it('일본 IP 는 일본어', () => {
    expect(localeFromCountry('JP')).toBe('ja')
    expect(localeFromCountry(' jp ')).toBe('ja')
  })
  it('한국·그 밖·헤더 없음은 한국어', () => {
    expect(localeFromCountry('KR')).toBe('ko')
    expect(localeFromCountry('US')).toBe('ko')
    expect(localeFromCountry(null)).toBe('ko')
    expect(localeFromCountry(undefined)).toBe('ko')
    expect(localeFromCountry('')).toBe('ko')
  })
})

describe('localeFromPath', () => {
  it('프리픽스가 있으면 그 로케일', () => {
    expect(localeFromPath('/ja')).toBe('ja')
    expect(localeFromPath('/ko/order/other')).toBe('ko')
  })
  it('프리픽스가 없거나 비슷한 이름은 null', () => {
    expect(localeFromPath('/')).toBeNull()
    expect(localeFromPath('/order/other')).toBeNull()
    expect(localeFromPath('/japan')).toBeNull()
  })
})
