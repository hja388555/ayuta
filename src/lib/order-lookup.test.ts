import { describe, expect, it } from 'vitest'
import { formatOrderSchedule, guestOwnershipMatches } from './order-lookup'

// 실제 DB 조회(findOwnedOrder)는 tests/order-lookup.integration.test.ts가 다룬다.
// 여기는 소유권 판정 로직만 DB 없이 떼어내 본다 — 특히 orderer가 없는 방어적 분기(Minor)는
// Payload 스키마상 만들기 어려운 행이라 순수 함수로 분리해야만 테스트할 수 있다.
describe('guestOwnershipMatches', () => {
  const order = {
    customer: null,
    orderer: { email: 'hong@example.com', phone: '010-1234-5678' },
  }

  it('이메일·연락처가 모두 맞으면 참이다', () => {
    expect(guestOwnershipMatches(order, { email: 'hong@example.com', phone: '010-1234-5678' })).toBe(true)
  })

  it('이메일 대소문자·공백은 무시한다', () => {
    expect(guestOwnershipMatches(order, { email: '  HONG@EXAMPLE.COM  ', phone: '010-1234-5678' })).toBe(true)
  })

  it('이메일만 맞고 연락처가 틀리면 거짓이다', () => {
    expect(guestOwnershipMatches(order, { email: 'hong@example.com', phone: '010-0000-0000' })).toBe(false)
  })

  it('연락처만 맞고 이메일이 틀리면 거짓이다', () => {
    expect(guestOwnershipMatches(order, { email: 'wrong@example.com', phone: '010-1234-5678' })).toBe(false)
  })

  it('둘 다 틀리면 거짓이다', () => {
    expect(guestOwnershipMatches(order, { email: 'wrong@example.com', phone: '010-0000-0000' })).toBe(false)
  })

  it('회원 주문(customer 있음)은 게스트 경로로 열리지 않는다', () => {
    const memberOrder = { customer: 7, orderer: order.orderer }
    expect(guestOwnershipMatches(memberOrder, { email: 'hong@example.com', phone: '010-1234-5678' })).toBe(false)
  })

  it('orderer가 없는 행이어도 던지지 않고 거짓을 돌려준다 (Minor)', () => {
    // Ruling 16의 백필 이전 레거시 데이터, 혹은 손상된 행을 가정한다
    const brokenOrder = { customer: null, orderer: null } as unknown as typeof order
    expect(() => guestOwnershipMatches(brokenOrder, { email: 'hong@example.com', phone: '010-1234-5678' })).not.toThrow()
    expect(guestOwnershipMatches(brokenOrder, { email: 'hong@example.com', phone: '010-1234-5678' })).toBe(false)
  })
})

describe('formatOrderSchedule', () => {
  it('아직 안 정해졌으면 협의 중으로 표시한다', () => {
    const view = formatOrderSchedule({}, '협의 중')
    expect(view.contractPeriod).toBe('협의 중')
    expect(view.adStartDate).toBe('협의 중')
  })

  it('정해진 계약기간은 YYYY-MM-DD ~ YYYY-MM-DD 로 표시한다', () => {
    const view = formatOrderSchedule(
      { contractStart: '2026-09-10T00:00:00+09:00', contractEnd: '2027-09-09T00:00:00+09:00' },
      '협의 중',
    )
    expect(view.contractPeriod).toBe('2026-09-10 ~ 2027-09-09')
  })

  it('한쪽만 정해졌으면 정해진 쪽은 그대로 보여준다', () => {
    const view = formatOrderSchedule({ contractStart: '2026-09-10T00:00:00+09:00' }, '협의 중')
    expect(view.contractPeriod).toBe('2026-09-10 ~ 협의 중')
  })

  it('로케일 문구는 호출자가 넘긴 것을 그대로 쓴다 (ja)', () => {
    expect(formatOrderSchedule({}, '協議中').adStartDate).toBe('協議中')
  })
})
