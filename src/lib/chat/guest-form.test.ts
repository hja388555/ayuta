import { describe, expect, it } from 'vitest'
import { validateGuestStart, type GuestStartValues } from './guest-form'

const ok: GuestStartValues = {
  name: '홍길동',
  email: 'hong@example.com',
  phone: '010-1234-5678',
  phoneCountry: 'KR',
  body: '지하철 광고 단가를 알고 싶습니다.',
  consent: true,
}

describe('비회원 문의 폼 검증', () => {
  it('제대로 채우면 오류가 없다', () => {
    expect(validateGuestStart(ok)).toEqual({})
  })

  it('문의 내용이 비면 막는다', () => {
    // 이 값이 첫 메시지로 들어가므로 비면 담당자가 빈 방을 받는다
    expect(validateGuestStart({ ...ok, body: '   ' }).body).toBe('required')
  })

  it('문의 내용이 500자를 넘으면 막는다', () => {
    expect(validateGuestStart({ ...ok, body: 'ㄱ'.repeat(501) }).body).toBe('tooLong')
  })

  it('500자까지는 받는다', () => {
    expect(validateGuestStart({ ...ok, body: 'ㄱ'.repeat(500) }).body).toBeUndefined()
  })

  it('이름·연락처·동의 규칙은 그대로다', () => {
    const e = validateGuestStart({ ...ok, name: '', phone: '', consent: false })
    expect(e.name).toBe('required')
    expect(e.phone).toBe('required')
    expect(e.consent).toBe('consent_required')
  })
})
