import { describe, expect, it } from 'vitest'
import { isFooterHidden } from './footer-visibility'

describe('isFooterHidden', () => {
  it('주문 결제 화면에서 숨긴다', () => {
    expect(isFooterHidden('/ko/order/digital-sns/checkout')).toBe(true)
    expect(isFooterHidden('/ja/order/digital-sns/checkout')).toBe(true)
  })

  it('견적 결제 화면에서 숨긴다', () => {
    expect(isFooterHidden('/ko/quote/abc123')).toBe(true)
    expect(isFooterHidden('/ja/quote/abc123')).toBe(true)
  })

  it('그 외 화면은 숨기지 않는다', () => {
    expect(isFooterHidden('/ko')).toBe(false)
    expect(isFooterHidden('/ko/order/digital-sns')).toBe(false)
    expect(isFooterHidden('/ko/mypage')).toBe(false)
    expect(isFooterHidden('/ko/order/complete')).toBe(false)
  })
})
