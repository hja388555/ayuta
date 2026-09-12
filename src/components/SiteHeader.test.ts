import { describe, expect, it } from 'vitest'
import { localeSwitchHref } from './SiteHeader'

describe('언어 전환 주소', () => {
  it('결제 화면의 쿼리(선택·나라·목적)를 그대로 싣는다', () => {
    expect(localeSwitchHref('/ko/order/transit/checkout', 'item=subway-city-seoul&period=2w&country=kr', 'ja')).toBe(
      '/ja/order/transit/checkout?item=subway-city-seoul&period=2w&country=kr',
    )
  })

  it('앞의 ? 는 한 번만 붙고, 쿼리가 없으면 경로만이다', () => {
    expect(localeSwitchHref('/ja/order/digital-sns', '?tier=basic', 'ko')).toBe('/ko/order/digital-sns?tier=basic')
    expect(localeSwitchHref('/ja', '', 'ko')).toBe('/ko')
  })

  it('경로 중간의 ko/ja 는 건드리지 않는다', () => {
    expect(localeSwitchHref('/ko/mypage/orders/ja-1', '', 'ja')).toBe('/ja/mypage/orders/ja-1')
  })
})
