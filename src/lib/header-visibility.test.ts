import { describe, expect, it } from 'vitest'
import { isHeaderHidden } from './header-visibility'

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
