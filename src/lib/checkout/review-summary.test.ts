import { describe, expect, it } from 'vitest'
import { buildReviewSummary } from './review-summary'

describe('주문 내역 확인 요약 (v3)', () => {
  it('카테고리 제목 → 금액 없는 선택 → 진한 금액 항목 순', () => {
    expect(buildReviewSummary('1.디지털 광고 / SNS 커뮤니티 (중복선택 가능)', [{ label: '플랫폼', value: '유튜브, 쇼츠' }], [{ label: '프리미엄' }])).toEqual({
      title: '1. 디지털 광고 / SNS 커뮤니티',
      lines: [{ text: '유튜브, 쇼츠', strong: false }, { text: '프리미엄', strong: true }],
    })
  })

  it('일본어 타이틀의 전각 괄호（…）도 뗀다', () => {
    expect(buildReviewSummary('1.デジタル広告 / SNSコミュニティ（複数選択可）', [], [{ label: 'プレミアム' }])).toEqual({
      title: '1. デジタル広告 / SNSコミュニティ',
      lines: [{ text: 'プレミアム', strong: true }],
    })
  })
})
