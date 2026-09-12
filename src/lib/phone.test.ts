import { describe, expect, it } from 'vitest'
import { isValidPhone } from './phone'
import { validateGuestStart } from './chat/guest-form'
import { scrollTargetTop } from './ui/focus-invalid'

describe('isValidPhone', () => {
  it.each(['010-1234-5678', '+81 90-1234-5678', '(02) 3394 8838'])('%s 는 통과', (v) => expect(isValidPhone(v)).toBe(true))
  it.each(['', '   ', 'abc', '010-abcd-5678', '12345', '1'.repeat(41)])('%s 는 거절', (v) => expect(isValidPhone(v)).toBe(false))
})

describe('validateGuestStart', () => {
  it('빈 폼은 네 칸 오류를 한꺼번에 낸다', () => {
    expect(validateGuestStart({ name: '', email: '', phone: '', consent: false })).toEqual({ name: 'required', email: 'required', phone: 'required', consent: 'consent_required' })
  })
  it('형식 오류는 칸별로 따로 낸다', () => {
    expect(validateGuestStart({ name: '손님', email: 'x', phone: 'abc', consent: true })).toEqual({ email: 'email', phone: 'phone' })
  })
  it('올바르면 오류 없음', () => {
    expect(validateGuestStart({ name: '손님', email: 'a@b.co', phone: '010-1234-5678', consent: true })).toEqual({})
  })
})

describe('scrollTargetTop', () => {
  it('고정 헤더와 여백만큼 덜 올리고 0 밑으로 내려가지 않는다', () => {
    expect(scrollTargetTop(300, 1000, 80)).toBe(1204)
    expect(scrollTargetTop(10, 0, 80)).toBe(0)
  })
})
