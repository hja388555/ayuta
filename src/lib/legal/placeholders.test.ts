import { describe, expect, it } from 'vitest'
import { unknownPlaceholders } from './placeholders'

describe('unknownPlaceholders', () => {
  it('fillContract 가 아는 빈칸만 있으면 빈 목록', () => {
    expect(unknownPlaceholders('금액 {{amount}} / 일자 {{contractDate}} / {{items}} / {{companyName}}')).toEqual([])
  })

  it('오타·모르는 빈칸을 한 번씩만 돌려준다', () => {
    expect(unknownPlaceholders('{{amout}} {{amout}} {{foo}} {{amount}}')).toEqual(['amout', 'foo'])
  })

  it('빈칸 문법이 아닌 중괄호는 건드리지 않는다', () => {
    expect(unknownPlaceholders('{단일} {{ 공백 }} 일반 문장')).toEqual([])
  })
})
