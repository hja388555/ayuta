import { describe, expect, it } from 'vitest'
import { canGuestSend, guestSendsLeft, GUEST_MESSAGE_LIMIT } from './guest-limit'

describe('비회원 메시지 횟수', () => {
  it('문의 폼으로 들어간 첫 메시지 뒤에도 한 번 더 보낼 수 있다', () => {
    expect(canGuestSend(1)).toBe(true)
  })

  it('두 번 보냈으면 더 보내지 못한다', () => {
    expect(canGuestSend(2)).toBe(false)
  })

  it('아직 아무것도 안 보냈으면 당연히 보낼 수 있다', () => {
    expect(canGuestSend(0)).toBe(true)
  })

  it('제한을 넘겨 쌓여 있어도 막는다', () => {
    // 동시에 두 번 눌러 3건이 들어간 경우에도 그 뒤는 막혀야 한다
    expect(canGuestSend(3)).toBe(false)
  })

  it('남은 횟수를 알려 준다', () => {
    expect(guestSendsLeft(0)).toBe(2)
    expect(guestSendsLeft(1)).toBe(1)
    expect(guestSendsLeft(2)).toBe(0)
    expect(guestSendsLeft(5)).toBe(0)
  })

  it('기준은 2회다', () => {
    expect(GUEST_MESSAGE_LIMIT).toBe(2)
  })
})
