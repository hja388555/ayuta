import { describe, expect, it } from 'vitest'
import { periodLineLabels } from './period-labels'

describe('4번 기간 줄 이름', () => {
  it('한국어는 "광고 기간 2주"처럼 폼과 같은 문구다', () => {
    expect(periodLineLabels('ko')).toEqual({ '1w': '광고 기간 1주', '2w': '광고 기간 2주', '1m': '광고 기간 1개월', '3m': '광고 기간 3개월' })
  })

  it('일본어 화면은 일본어 문구다 — 한국어·키가 섞이지 않는다', () => {
    const ja = periodLineLabels('ja')
    expect(ja['2w']).toBe('広告期間 2週間')
    expect(Object.values(ja).join('')).not.toMatch(/[가-힣]|\d[wm]\b/)
  })
})
