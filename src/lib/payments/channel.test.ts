import { describe, expect, it } from 'vitest'
import { channelKeyFor, currencyForLocale } from './channel'

const ENV = { krw: 'channel-key-krw', jpy: 'channel-key-jpy' }

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

describe('채널 선택', () => {
  it('통화에 맞는 채널키를 준다', () => {
    expect(channelKeyFor('KRW', ENV)).toBe('channel-key-krw')
    expect(channelKeyFor('JPY', ENV)).toBe('channel-key-jpy')
  })

  it('채널키가 없으면 결제창을 띄우기 전에 실패한다', () => {
    expect(() => channelKeyFor('JPY', { krw: 'k' })).toThrow(/JPY/)
  })
})
