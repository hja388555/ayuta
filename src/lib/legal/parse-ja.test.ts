import { describe, expect, it } from 'vitest'
import { blocksToText, headingsOf, parseLegal } from './parse'
import { REFUND_JA_BODY, TERMS_JA_BODY } from './ja-drafts'

describe('일본어 약관 파싱', () => {
  it('"第N条" 줄을 번호 제목으로 본다', () => {
    const heads = headingsOf(parseLegal(TERMS_JA_BODY))
    expect(heads.map((h) => h.num)).toEqual(['1', '2', '3', '4', '5', '6'])
    expect(heads[0]!.text).toBe('第1条 目的')
  })

  it('일본어 초벌 번역도 한 글자도 잃지 않는다', () => {
    for (const body of [TERMS_JA_BODY, REFUND_JA_BODY]) {
      expect(blocksToText(parseLegal(body))).toBe(body)
    }
  })

  it('환불 정책 일본어판도 안내 상자·주의 문단을 알아본다', () => {
    const types = parseLegal(REFUND_JA_BODY).map((b) => b.type)
    expect(types).toContain('callout')
    expect(types).toContain('note')
  })
})
