import { describe, expect, it } from 'vitest'
import { otpDelivery } from './otp-delivery'

describe('otpDelivery — 관리자 코드 전달 방식', () => {
  it('메일 어댑터가 있으면 환경과 무관하게 메일로 보낸다', () => {
    expect(otpDelivery(true, 'production')).toBe('email')
    expect(otpDelivery(true, 'development')).toBe('email')
  })

  it('메일이 없는 개발 환경에서는 서버 로그에 남긴다 — Payload 콘솔 어댑터는 본문을 버린다', () => {
    expect(otpDelivery(false, 'development')).toBe('log')
    expect(otpDelivery(false, 'test')).toBe('log')
    expect(otpDelivery(false, undefined)).toBe('log')
  })

  it('메일이 없는 운영 환경에서는 발급을 거부한다 — 운영 로그에 코드를 남기지 않는다', () => {
    expect(otpDelivery(false, 'production')).toBe('refuse')
    expect(otpDelivery(false, 'production', false)).toBe('refuse')
  })

  it('운영 모드 테스트 서버(CI)는 명시적으로 켰을 때만 서버 로그로 보낸다', () => {
    expect(otpDelivery(false, 'production', true)).toBe('log')
    // 메일이 설정돼 있으면 스위치와 무관하게 메일이다
    expect(otpDelivery(true, 'production', true)).toBe('email')
  })
})
