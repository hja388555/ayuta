import { describe, expect, it } from 'vitest'
import { numberByListPosition, stripLeadingNumber } from './list-numbering'

describe('저장된 번호 떼기', () => {
  it('"1. " 같은 마침표 번호를 뗀다', () => {
    expect(stripLeadingNumber('1. 디지털/SNS광고')).toBe('디지털/SNS광고')
  })

  it('공백 없는 "5.기타" 도 뗀다', () => {
    expect(stripLeadingNumber('5.기타')).toBe('기타')
  })

  it('괄호 번호("6) 이름")도 뗀다', () => {
    expect(stripLeadingNumber('6) 옥외 전광판 광고')).toBe('옥외 전광판 광고')
  })

  it('번호가 없으면 그대로 둔다', () => {
    expect(stripLeadingNumber('옥외 전광판 광고')).toBe('옥외 전광판 광고')
  })
})

describe('목록 순서대로 번호 다시 매기기', () => {
  it('저장된 번호와 상관없이 1..N을 놓인 순서대로 붙인다', () => {
    // 관리자가 6번째 서비스를 추가해도 "기타"(마지막 자리)가 항상 마지막 번호를 받는다
    const names = ['1. 디지털/SNS광고', '2. 국내/현지 전문영상촬영', '3. 종이신문/지역신문/블로그', '4. 지하철. 버스광고', '6. 옥외 전광판 광고', '5. 기타']
    expect(numberByListPosition(names)).toEqual([
      '1. 디지털/SNS광고',
      '2. 국내/현지 전문영상촬영',
      '3. 종이신문/지역신문/블로그',
      '4. 지하철. 버스광고',
      '5. 옥외 전광판 광고',
      '6. 기타',
    ])
  })

  it('빈 목록은 빈 배열', () => {
    expect(numberByListPosition([])).toEqual([])
  })
})
