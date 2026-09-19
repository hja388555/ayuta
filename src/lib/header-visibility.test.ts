import { describe, expect, it } from 'vitest'
import { hideHeaderSignup, isHeaderHidden, isOwnAuthPage, isPcHeaderHidden } from './header-visibility'

describe('헤더 숨김 판정(6라운드)', () => {
  it('1~4번 주문 화면(digital-sns·local-video·press-blog·transit)은 헤더를 숨긴다', () => {
    expect(isHeaderHidden('/ko/order/digital-sns')).toBe(true)
    expect(isHeaderHidden('/ja/order/local-video')).toBe(true)
    expect(isHeaderHidden('/ko/order/press-blog')).toBe(true)
    expect(isHeaderHidden('/ko/order/transit')).toBe(true)
  })

  it('같은 카테고리라도 결제(checkout) 화면은 헤더를 유지한다', () => {
    expect(isHeaderHidden('/ko/order/transit/checkout')).toBe(false)
    expect(isHeaderHidden('/ja/order/digital-sns/checkout')).toBe(false)
  })

  it('5번(other)·메인·마이페이지 등 나머지는 헤더를 유지한다', () => {
    expect(isHeaderHidden('/ko/order/other')).toBe(false)
    expect(isHeaderHidden('/ko')).toBe(false)
    expect(isHeaderHidden('/ko/mypage')).toBe(false)
    expect(isHeaderHidden('/ja/quote/abc123')).toBe(false)
  })
})

describe('PC 헤더 숨김 판정(메인에만 헤더)', () => {
  it('주문 흐름(1~5번·결제)과 견적 확인 화면은 PC 에서 헤더를 숨긴다', () => {
    expect(isPcHeaderHidden('/ko/order/digital-sns')).toBe(true)
    expect(isPcHeaderHidden('/ko/order/transit/checkout')).toBe(true)
    expect(isPcHeaderHidden('/ja/order/other')).toBe(true)
    expect(isPcHeaderHidden('/ko/order/complete')).toBe(true)
    expect(isPcHeaderHidden('/ja/quote/abc123')).toBe(true)
  })

  it('메인·마이페이지·로그인 등은 PC 에서도 헤더를 유지한다', () => {
    expect(isPcHeaderHidden('/ko')).toBe(false)
    expect(isPcHeaderHidden('/ja/')).toBe(false)
    expect(isPcHeaderHidden('/ko/mypage')).toBe(false)
    expect(isPcHeaderHidden('/ko/login')).toBe(false)
    expect(isPcHeaderHidden('/ko/orders')).toBe(false)
  })
})

describe('로그인·가입 화면의 같은 버튼 숨김 판정', () => {
  it('보고 있는 화면으로 다시 보내는 버튼만 숨긴다', () => {
    expect(isOwnAuthPage('/ko/login', 'login')).toBe(true)
    expect(isOwnAuthPage('/ja/signup', 'signup')).toBe(true)
    expect(isOwnAuthPage('/ko/login', 'signup')).toBe(false)
    expect(isOwnAuthPage('/ja/signup', 'login')).toBe(false)
  })

  it('다른 화면과 하위 경로는 그대로 보여준다', () => {
    expect(isOwnAuthPage('/ko', 'login')).toBe(false)
    expect(isOwnAuthPage('/ko/mypage', 'login')).toBe(false)
    expect(isOwnAuthPage('/ko/login/reset', 'login')).toBe(false)
  })
})

describe('헤더 회원가입 숨김 판정(2026-09-19 클라이언트 요청 — 한 화면에 같은 기능 버튼 하나)', () => {
  it('/signup 과 채팅 화면에서는 헤더 회원가입을 숨긴다', () => {
    expect(hideHeaderSignup('/ko/chat')).toBe(true)
    expect(hideHeaderSignup('/ja/chat/abc')).toBe(true)
    expect(hideHeaderSignup('/ja/signup')).toBe(true)
  })

  it('그 외 화면은 헤더 회원가입을 유지한다', () => {
    expect(hideHeaderSignup('/ko')).toBe(false)
    expect(hideHeaderSignup('/ko/login')).toBe(false)
  })
})
