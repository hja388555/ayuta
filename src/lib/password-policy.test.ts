import { describe, expect, it } from 'vitest'
import { passwordIssue } from './password-policy'

describe('passwordIssue', () => {
  it('영문·숫자·기호 10자 이상이면 통과', () => {
    expect(passwordIssue('Ayuta!Test-2026')).toBeNull()
    expect(passwordIssue('abcdefg1!x')).toBeNull()
  })
  it('길이', () => {
    expect(passwordIssue('Ab1!abcde')).toBe('too_short')
    expect(passwordIssue(`Ab1!${'a'.repeat(125)}`)).toBe('too_long')
  })
  it('종류가 빠지면 무엇이 빠졌는지 알려준다', () => {
    expect(passwordIssue('1234567890!')).toBe('needs_letter')
    expect(passwordIssue('abcdefghij!')).toBe('needs_number')
    expect(passwordIssue('abcdefghij1')).toBe('needs_symbol')
  })
})
