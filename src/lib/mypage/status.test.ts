import { describe, expect, it } from 'vitest'
import { matchesFilter, summarize, toSummaryFilter } from './status'

describe('마이페이지 요약 카드 필터', () => {
  const statuses = ['pending', 'paid', 'in_progress', 'done', 'cancelled', 'failed']

  it('필터 결과 건수가 요약 카드 숫자와 같다', () => {
    const c = summarize(statuses)
    expect(statuses.filter((s) => matchesFilter(s, 'active')).length).toBe(c.active)
    expect(statuses.filter((s) => matchesFilter(s, 'done')).length).toBe(c.done)
    expect(statuses.filter((s) => matchesFilter(s, 'refund')).length).toBe(c.refund)
    expect(statuses.filter((s) => matchesFilter(s, 'all')).length).toBe(c.total)
  })

  it('모르는 값은 전체로 본다', () => {
    expect(toSummaryFilter('active')).toBe('active')
    expect(toSummaryFilter('nope')).toBe('all')
    expect(toSummaryFilter(undefined)).toBe('all')
  })
})
