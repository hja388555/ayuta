import { describe, expect, it } from 'vitest'
import { formatAmount, formatDateTime, formatDay, toDateInputValue } from './format'

describe('formatAmount', () => {
  it('원·엔 모두 소수점 없이 낸다', () => {
    expect(formatAmount(1_500_000, 'KRW')).toContain('1,500,000')
    expect(formatAmount(120_000, 'JPY')).toContain('120,000')
    expect(formatAmount(1_500_000, 'KRW')).not.toContain('.')
  })
})

describe('formatDay', () => {
  it('Asia/Seoul 기준 그날로 자른다', () => {
    // UTC 15:30 = Seoul 다음 날 00:30
    expect(formatDay('2026-09-09T15:30:00.000Z')).toBe('2026-09-10')
  })

  it('없는 값·깨진 값은 미정으로', () => {
    expect(formatDay(null)).toBe('미정')
    expect(formatDay('무엇')).toBe('미정')
  })
})

describe('formatDateTime', () => {
  it('없는 값은 대시로', () => {
    expect(formatDateTime(null)).toBe('—')
    expect(formatDateTime('무엇')).toBe('—')
  })
})

describe('toDateInputValue', () => {
  it('date 입력이 받는 형식으로 낸다', () => {
    expect(toDateInputValue('2026-09-09T15:30:00.000Z')).toBe('2026-09-10')
  })

  it('미정은 빈 문자열 — placeholder 가 아니라 진짜 빈 값이어야 지울 수 있다', () => {
    expect(toDateInputValue(null)).toBe('')
  })
})
