import { describe, expect, it } from 'vitest'
import { isFloatingVisible } from './floating-visibility'

describe('isFloatingVisible', () => {
  it('메인에서만 보인다', () => {
    expect(isFloatingVisible('/ko')).toBe(true)
    expect(isFloatingVisible('/ja/')).toBe(true)
  })
  it('1~5번·결제·그 밖에서는 숨긴다', () => {
    expect(isFloatingVisible('/ko/order/digital-sns')).toBe(false)
    expect(isFloatingVisible('/ko/order/other')).toBe(false)
    expect(isFloatingVisible('/ko/order/transit/checkout')).toBe(false)
    expect(isFloatingVisible('/ko/mypage')).toBe(false)
  })
})
