import { describe, expect, it } from 'vitest'
import { defaultSortOrderForNew, nextServiceNo, serviceSlug } from './new-service'

describe('새 서비스 번호', () => {
  it('기존 최대 번호 다음을 쓴다', () => {
    expect(nextServiceNo([1, 2, 3, 4, 5])).toBe(6)
  })

  it('중간이 비어 있어도 최대값 다음이다', () => {
    // 지워진 번호를 다시 쓰면 그 번호로 받은 옛 주문이 새 서비스를 가리킨다
    expect(nextServiceNo([1, 2, 5])).toBe(6)
  })

  it('하나도 없으면 1번부터', () => {
    expect(nextServiceNo([])).toBe(1)
  })
})

describe('새 서비스 주소', () => {
  it('영문 이름은 그대로 주소가 된다', () => {
    expect(serviceSlug('Outdoor LED', 6, [])).toBe('outdoor-led')
  })

  it('한국어 이름처럼 쓸 글자가 없으면 번호를 쓴다', () => {
    expect(serviceSlug('옥외 전광판 광고', 6, [])).toBe('service-6')
  })

  it('숫자만 남는 이름도 번호를 쓴다', () => {
    // "6. 옥외 광고 2026" 처럼 한글이 떨어져 나가면 숫자만 남는다 — 뜻 없는 주소가 된다
    expect(serviceSlug('6. 옥외 광고 2026', 6, [])).toBe('service-6')
  })

  it('이미 쓰는 주소면 번호를 붙인다', () => {
    expect(serviceSlug('Outdoor LED', 7, ['outdoor-led'])).toBe('outdoor-led-7')
  })

  it('붙인 주소까지 겹치면 하나씩 올린다', () => {
    expect(serviceSlug('Outdoor LED', 7, ['outdoor-led', 'outdoor-led-7'])).toBe('outdoor-led-8')
  })

  it('화면 주소와 겹치는 이름은 피한다', () => {
    // /order/order 같은 주소가 생기면 라우팅이 헷갈린다
    expect(serviceSlug('order', 6, [])).toBe('order-6')
  })
})

describe('새 서비스 기본 순서', () => {
  const existing = [
    { sortOrder: 10, model: 'tier' },
    { sortOrder: 20, model: 'videoPairs' },
    { sortOrder: 30, model: 'sum' },
    { sortOrder: 40, model: 'sumMultiplier' },
    { sortOrder: 50, model: 'inquiry' }, // 기타
  ]

  it('「기타」 앞, 나머지 뒤에 놓인다', () => {
    const order = defaultSortOrderForNew(existing)
    expect(order).toBeGreaterThan(40)
    expect(order).toBeLessThan(50)
  })

  it('「기타」가 없으면 마지막 뒤에 놓인다', () => {
    expect(defaultSortOrderForNew(existing.slice(0, 4))).toBe(50)
  })

  it('「기타」 앞에 자리가 없어도(연속 값) 순서를 어기지 않는다', () => {
    const tight = [
      { sortOrder: 40, model: 'sum' },
      { sortOrder: 41, model: 'inquiry' },
    ]
    const order = defaultSortOrderForNew(tight)
    expect(order).toBeGreaterThan(40)
  })

  it('서비스가 하나도 없으면 10부터', () => {
    expect(defaultSortOrderForNew([])).toBe(10)
  })

  it('이름이 아니라 계산 방식(model)으로 「기타」를 찾는다', () => {
    // 이름이 "기타"가 아니어도 model: 'inquiry' 면 문의형으로 본다
    const renamed = [{ sortOrder: 10, model: 'tier' }, { sortOrder: 50, model: 'inquiry' }]
    expect(defaultSortOrderForNew(renamed)).toBeGreaterThan(10)
    expect(defaultSortOrderForNew(renamed)).toBeLessThan(50)
  })
})
