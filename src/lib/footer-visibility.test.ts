import { describe, expect, it } from 'vitest'
import { isFooterHidden } from './footer-visibility'

describe('isFooterHidden', () => {
  it('메인에서는 보인다', () => {
    expect(isFooterHidden('/ko')).toBe(false)
    expect(isFooterHidden('/ja')).toBe(false)
    expect(isFooterHidden('/ko/')).toBe(false)
  })

  it('주문 폼 1~5번에서 숨긴다', () => {
    expect(isFooterHidden('/ko/order/digital-sns')).toBe(true)
    expect(isFooterHidden('/ja/order/transit')).toBe(true)
    expect(isFooterHidden('/ko/order/other')).toBe(true)
  })

  it('결제·견적 결제·그 밖의 화면에서도 숨긴다', () => {
    expect(isFooterHidden('/ko/order/digital-sns/checkout')).toBe(true)
    expect(isFooterHidden('/ja/quote/abc123')).toBe(true)
    expect(isFooterHidden('/ko/mypage')).toBe(true)
    expect(isFooterHidden('/ko/order/complete')).toBe(true)
  })
})
