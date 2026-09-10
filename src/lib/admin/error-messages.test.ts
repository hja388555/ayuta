import { describe, expect, it } from 'vitest'
import { adminErrorMessage, GENERIC_ERROR } from './error-messages'

describe('adminErrorMessage', () => {
  it('API 가 실제로 내는 코드를 전부 번역한다', () => {
    const codes = [
      'otp_required',
      'unauthenticated',
      'forbidden',
      'invalid_input',
      'invalid_transition',
      'transition_failed',
      'invalid_schedule',
      'schedule_failed',
      'note_failed',
    ]
    for (const code of codes) {
      const message = adminErrorMessage(code)
      expect(message).not.toBe(GENERIC_ERROR)
      // 내부 코드가 화면에 그대로 새어 나가면 안 된다
      expect(message).not.toContain(code)
    }
  })

  it('모르는 코드·비문자열은 일반 문구로 떨어뜨린다', () => {
    expect(adminErrorMessage('무언가_새_코드')).toBe(GENERIC_ERROR)
    expect(adminErrorMessage(undefined)).toBe(GENERIC_ERROR)
    expect(adminErrorMessage({ error: 'x' })).toBe(GENERIC_ERROR)
  })
})
