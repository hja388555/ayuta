import { describe, expect, it } from 'vitest'
import { keepTrailingWordTogether } from './label-wrap'

describe('keepTrailingWordTogether', () => {
  it('마지막 단어가 한 글자면 앞 단어와 줄바꿈 없는 공백으로 묶는다', () => {
    const result = keepTrailingWordTogether('역내 포스터 제작 함')
    expect(result).toBe('역내 포스터 제작 함')
  })

  it('마지막 단어가 두 글자 이상이면 그대로 둔다', () => {
    expect(keepTrailingWordTogether('역내 포스터 제작 안함')).toBe('역내 포스터 제작 안함')
  })

  it('공백이 없으면 그대로 둔다', () => {
    expect(keepTrailingWordTogether('한글자')).toBe('한글자')
  })

  it('빈 문자열도 그대로 둔다', () => {
    expect(keepTrailingWordTogether('')).toBe('')
  })
})
