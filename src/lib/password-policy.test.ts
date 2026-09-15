import { describe, expect, it } from 'vitest'
import { passwordIssue } from './password-policy'

describe('passwordIssue', () => {
  it('8자 이상이면 통과한다 — 문자 종류는 따지지 않는다', () => {
    expect(passwordIssue('Ayuta!Test-2026')).toBeNull()
    expect(passwordIssue('abcdefgh')).toBeNull()
    expect(passwordIssue('12345678')).toBeNull()
  })
  it('길이', () => {
    expect(passwordIssue('abcdefg')).toBe('too_short')
    expect(passwordIssue('a'.repeat(129))).toBe('too_long')
  })
})
