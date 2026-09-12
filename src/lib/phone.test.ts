import { describe, expect, it } from 'vitest'
import {
  defaultPhoneCountry,
  formatPhone,
  formatPhoneForContract,
  initialPhoneInput,
  isValidPhone,
  normalizePhone,
  phoneErrorCountry,
  phoneMatchKey,
  tidyPhoneInput,
} from './phone'
import { validateGuestStart } from './chat/guest-form'
import { scrollTargetTop } from './ui/focus-invalid'

describe('normalizePhone — 한국', () => {
  it.each([
    ['010-1234-5678', '+821012345678'],
    ['01012345678', '+821012345678'],
    [' 010 1234 5678 ', '+821012345678'],
    ['(010) 1234.5678', '+821012345678'],
    ['+82 10-1234-5678', '+821012345678'],
    ['+82 010-1234-5678', '+821012345678'],
    ['0082 10 1234 5678', '+821012345678'],
    ['011-123-4567', '+82111234567'],
    ['016-1234-5678', '+821612345678'],
    ['02-339-4883', '+8223394883'],
    ['02-3394-8838', '+82233948838'],
    ['031-123-4567', '+82311234567'],
    ['064-1234-5678', '+826412345678'],
    ['070-1234-5678', '+827012345678'],
    ['1588-1234', '+8215881234'],
    ['+82 1588-1234', '+8215881234'],
  ])('%s → %s', (raw, e164) => expect(normalizePhone(raw, 'KR')).toBe(e164))

  it.each([
    '',
    '   ',
    'abc',
    '010-abcd-5678',
    '010-1234-567',
    '010-1234-56789',
    '012-1234-5678',
    '090-1234-5678',
    '02-12-3456',
    '030-123-4567',
    '065-123-4567',
    '070-123-4567',
    '1234-5678',
    '82 10 1234 5678',
    '+1 202 555 0100',
    '010+1234',
    '1'.repeat(41),
  ])('%s 는 거절', (raw) => expect(normalizePhone(raw, 'KR')).toBeNull())
})

describe('normalizePhone — 일본', () => {
  it.each([
    ['090-1234-5678', '+819012345678'],
    ['080 1234 5678', '+818012345678'],
    ['07012345678', '+817012345678'],
    ['050-1234-5678', '+815012345678'],
    ['03-1234-5678', '+81312345678'],
    ['045-123-4567', '+81451234567'],
    ['0120-123-456', '+81120123456'],
    ['+81 90-1234-5678', '+819012345678'],
    ['+81 090 1234 5678', '+819012345678'],
    ['0081-90-1234-5678', '+819012345678'],
  ])('%s → %s', (raw, e164) => expect(normalizePhone(raw, 'JP')).toBe(e164))

  it.each(['090-1234-567', '090-1234-56789', '010-1234-5678', '060-1234-5678', '090-123-4567', '0312345678901', '12-3456-7890'])('%s 는 거절', (raw) =>
    expect(normalizePhone(raw, 'JP')).toBeNull(),
  )
})

describe('나라와 국가번호', () => {
  it('국가번호가 있으면 고른 나라보다 우선한다', () => {
    expect(normalizePhone('+81 90-1234-5678', 'KR')).toBe('+819012345678')
    expect(normalizePhone('+82 10-1234-5678', 'JP')).toBe('+821012345678')
  })
  it('국가번호가 없으면 고른 나라 규칙으로만 본다', () => {
    expect(isValidPhone('090-1234-5678', 'KR')).toBe(false)
    expect(isValidPhone('010-1234-5678', 'JP')).toBe(false)
    expect(normalizePhone('070-1234-5678', 'JP')).toBe('+817012345678')
  })
  it('오류 문구 나라는 국가번호 우선', () => {
    expect(phoneErrorCountry('+81 12', 'KR')).toBe('JP')
    expect(phoneErrorCountry('0101', 'JP')).toBe('JP')
    expect(phoneErrorCountry('abc', 'KR')).toBe('KR')
  })
})

describe('표기', () => {
  it.each([
    ['+821012345678', '010-1234-5678'],
    ['+82111234567', '011-123-4567'],
    ['+8223394883', '02-339-4883'],
    ['+82233948838', '02-3394-8838'],
    ['+82311234567', '031-123-4567'],
    ['+8215881234', '1588-1234'],
    ['+819012345678', '090-1234-5678'],
    ['+81312345678', '03-1234-5678'],
    ['+81451234567', '045-123-4567'],
    ['+81120123456', '0120-123-456'],
  ])('formatPhone(%s) = %s', (stored, shown) => expect(formatPhone(stored)).toBe(shown))

  it('읽을 수 없는 예전 값은 그대로 보여 준다', () => {
    expect(formatPhone('010-1234-5678')).toBe('010-1234-5678')
    expect(formatPhone('+1 202 555 0100')).toBe('+1 202 555 0100')
    expect(formatPhone(null)).toBe('')
  })

  it('계약서: 한국은 국내 표기, 일본은 +81 을 붙인다', () => {
    expect(formatPhoneForContract('+821012345678')).toBe('010-1234-5678')
    expect(formatPhoneForContract('+819012345678')).toBe('+81 90-1234-5678')
    expect(formatPhoneForContract('+81312345678')).toBe('+81 3-1234-5678')
    expect(formatPhoneForContract('010-1234-5678')).toBe('010-1234-5678')
  })
})

describe('phoneMatchKey — 같은 번호 비교', () => {
  it('국가번호·앞 0·하이픈과 무관하게 같다', () => {
    const keys = ['+821012345678', '010-1234-5678', '01012345678', '+82 010 1234 5678', '0082-10-1234-5678'].map(phoneMatchKey)
    expect(new Set(keys)).toEqual(new Set(['1012345678']))
    expect(phoneMatchKey('+819012345678')).toBe(phoneMatchKey('090-1234-5678'))
  })
  it('다른 번호·빈 값', () => {
    expect(phoneMatchKey('010-0000-0000')).not.toBe(phoneMatchKey('+821012345678'))
    expect(phoneMatchKey('---')).toBe('')
  })
})

describe('입력칸 도우미', () => {
  it('처음 나라: 저장값 > 표지 국가 하나 > 언어', () => {
    expect(defaultPhoneCountry({ stored: '+819012345678', coverCountries: ['kr'], locale: 'ko' })).toBe('JP')
    expect(defaultPhoneCountry({ stored: '010-1234-5678', coverCountries: ['jp'], locale: 'ko' })).toBe('JP')
    expect(defaultPhoneCountry({ coverCountries: ['jp', 'kr'], locale: 'ko' })).toBe('KR')
    expect(defaultPhoneCountry({ coverCountries: ['jp', 'jp'], locale: 'ko' })).toBe('JP')
    expect(defaultPhoneCountry({ coverCountries: ['xx'], locale: 'ja' })).toBe('JP')
    expect(defaultPhoneCountry({})).toBe('KR')
  })
  it('저장값을 나라·국내 표기로 푼다. 예전 값은 그대로', () => {
    expect(initialPhoneInput('+819012345678', 'KR')).toEqual({ country: 'JP', value: '090-1234-5678' })
    expect(initialPhoneInput('010-1234-5678', 'JP')).toEqual({ country: 'JP', value: '010-1234-5678' })
    expect(initialPhoneInput(undefined, 'KR')).toEqual({ country: 'KR', value: '' })
  })
  it('칸을 벗어날 때: 올바르면 국내 표기, 국가번호면 나라도 바꾼다', () => {
    expect(tidyPhoneInput('01012345678', 'KR')).toEqual({ country: 'KR', value: '010-1234-5678' })
    expect(tidyPhoneInput('+81 9012345678', 'KR')).toEqual({ country: 'JP', value: '090-1234-5678' })
    expect(tidyPhoneInput('0101234', 'KR')).toBeNull()
  })
})

describe('validateGuestStart', () => {
  it('빈 폼은 네 칸 오류를 한꺼번에 낸다', () => {
    expect(validateGuestStart({ name: '', email: '', phone: '', phoneCountry: 'KR', consent: false })).toEqual({ name: 'required', email: 'required', phone: 'required', consent: 'consent_required' })
  })
  it('형식 오류는 칸별로 따로 낸다', () => {
    expect(validateGuestStart({ name: '손님', email: 'x', phone: 'abc', phoneCountry: 'KR', consent: true })).toEqual({ email: 'email', phone: 'phone' })
    expect(validateGuestStart({ name: '손님', email: 'a@b.co', phone: '010-1234-5678', phoneCountry: 'JP', consent: true })).toEqual({ phone: 'phone' })
  })
  it('올바르면 오류 없음', () => {
    expect(validateGuestStart({ name: '손님', email: 'a@b.co', phone: '010-1234-5678', phoneCountry: 'KR', consent: true })).toEqual({})
    expect(validateGuestStart({ name: '손님', email: 'a@b.co', phone: '090-1234-5678', phoneCountry: 'JP', consent: true })).toEqual({})
  })
})

describe('scrollTargetTop', () => {
  it('고정 헤더와 여백만큼 덜 올리고 0 밑으로 내려가지 않는다', () => {
    expect(scrollTargetTop(300, 1000, 80)).toBe(1204)
    expect(scrollTargetTop(10, 0, 80)).toBe(0)
  })
})
