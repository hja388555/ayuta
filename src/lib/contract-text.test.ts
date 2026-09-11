import { describe, expect, it } from 'vitest'
import { isArticleHeading, splitContractBlocks } from './contract-text'

describe('isArticleHeading', () => {
  it('제N조로 시작하는 줄만 제목으로 본다', () => {
    expect(isArticleHeading('제1조 계약 상품')).toBe(true)
    expect(isArticleHeading('제10조(계약 확인)')).toBe(true)
    expect(isArticleHeading('  제 3 조 자료 제공')).toBe(true)
    expect(isArticleHeading('제3자의 권리 문제는')).toBe(false)
    expect(isArticleHeading('본 계약은 제1조에 따라')).toBe(false)
    expect(isArticleHeading('제1조항은')).toBe(false)
    expect(isArticleHeading('')).toBe(false)
  })
})

describe('splitContractBlocks', () => {
  const text = '본 계약은 목적으로 합니다.\n\n제1조 계약 상품\n선택 상품: A\n\n제2조 제공 서비스\n릴스 제작'

  it('조항별로 묶는다', () => {
    const blocks = splitContractBlocks(text)
    expect(blocks.map((b) => b.heading)).toEqual([null, '제1조 계약 상품', '제2조 제공 서비스'])
    expect(blocks[1]!.body).toBe('선택 상품: A\n')
  })

  it('다시 합치면 원문과 글자 하나 다르지 않다', () => {
    const joined = splitContractBlocks(text)
      .map((b) => (b.heading === null ? b.body : `${b.heading}\n${b.body}`))
      .join('\n')
    expect(joined).toBe(text)
  })

  it('조항이 없으면 한 덩어리', () => {
    expect(splitContractBlocks('그냥 글')).toEqual([{ heading: null, body: '그냥 글' }])
  })
})
