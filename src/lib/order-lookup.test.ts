import { describe, expect, it } from 'vitest'
import { guestOwnershipMatches } from './order-lookup'

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
