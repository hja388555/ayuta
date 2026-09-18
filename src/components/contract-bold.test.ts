import { describe, expect, it } from 'vitest'
import { parseBoldSegments } from '../lib/contract-bold'

describe('계약서 조항 본문의 **강조** 파싱(ContractModal)', () => {
  it('짝이 맞는 **...**는 굵은 구간으로 나뉜다', () => {
    expect(parseBoldSegments('본문 **「선택 상품 내용」**을 기준으로 합니다.')).toEqual([
      { bold: false, text: '본문 ' },
      { bold: true, text: '「선택 상품 내용」' },
      { bold: false, text: '을 기준으로 합니다.' },
    ])
  })

  it('강조가 여러 번 나오면 각각 나뉜다', () => {
    expect(parseBoldSegments('**A** 사이 **B**')).toEqual([
      { bold: true, text: 'A' },
      { bold: false, text: ' 사이 ' },
      { bold: true, text: 'B' },
    ])
  })

  it('강조가 없으면 원문 그대로 한 구간이다', () => {
    expect(parseBoldSegments('그냥 본문')).toEqual([{ bold: false, text: '그냥 본문' }])
  })

  it('닫는 짝이 없으면(** 하나만) 별표까지 그대로 보여준다', () => {
    expect(parseBoldSegments('여는 별표만 **있는 문장')).toEqual([{ bold: false, text: '여는 별표만 **있는 문장' }])
  })

  it('빈 문자열은 빈 배열이다', () => {
    expect(parseBoldSegments('')).toEqual([])
  })
})
