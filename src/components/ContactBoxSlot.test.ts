import { describe, expect, it } from 'vitest'
import { hideContactBox } from './ContactBoxSlot'

describe('문의 박스 노출 경로', () => {
  it('채팅과 주문(1~5번·결제) 화면에서는 숨긴다', () => {
    for (const p of ['/ko/chat', '/ja/chat/g/abc', '/ko/order/digital-sns', '/ja/order/transit/checkout', '/ko/order/other']) {
      expect(hideContactBox(p)).toBe(true)
    }
  })
  it('메인·마이페이지 등은 보인다', () => {
    for (const p of ['/ko', '/ja', '/ko/mypage', '/ko/order-lookup', '/ko/orders']) expect(hideContactBox(p)).toBe(false)
  })
})
