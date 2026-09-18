import { describe, expect, it } from 'vitest'
import { isArticleHeading, splitContractBlocks, type ContractBlock } from './contract-text'

/** 글 블록만 골라 본다 — 「선택 상품 내용」 블록은 heading/body 가 없다 */
function articles(blocks: ContractBlock[]) {
  return blocks.filter((b): b is { heading: string | null; body: string } => !('items' in b))
}

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
    const blocks = articles(splitContractBlocks(text))
    expect(blocks.map((b) => b.heading)).toEqual([null, '제1조 계약 상품', '제2조 제공 서비스'])
    expect(blocks[1]!.body).toBe('선택 상품: A\n')
  })

  it('다시 합치면 원문과 글자 하나 다르지 않다', () => {
    const joined = articles(splitContractBlocks(text))
      .map((b) => (b.heading === null ? b.body : `${b.heading}\n${b.body}`))
      .join('\n')
    expect(joined).toBe(text)
  })

  it('조항이 없으면 한 덩어리', () => {
    expect(splitContractBlocks('그냥 글')).toEqual([{ heading: null, body: '그냥 글' }])
  })
})

describe('선택 상품 내용 구간', () => {
  const BAR = '────────────────────────────────'
  const text = [
    '제10조 (계약의 성립)',
    '동의하면 계약이 성립합니다.',
    '',
    BAR,
    '선택 상품 내용',
    BAR,
    '광고 국가      : 일본',
    '광고 채널      : Instagram · X(트위터)',
    '촬영 예정일    :',
    BAR,
    '총 계약금액    : ₩3,850,000',
    BAR,
    '',
    '서비스 제공자',
    'AYUTA (아유타)',
  ].join('\n')

  it('선으로 감싼 구간을 라벨·값으로 뜯는다', () => {
    const blocks = splitContractBlocks(text)
    const items = blocks.find((b) => 'items' in b)
    expect(items && 'items' in items ? items.items : null).toEqual({
      caption: '선택 상품 내용',
      rows: [
        { label: '광고 국가', value: '일본' },
        { label: '광고 채널', value: 'Instagram · X(트위터)' },
        { label: '촬영 예정일', value: '' },
      ],
      total: { label: '총 계약금액', value: '₩3,850,000' },
    })
  })

  it('구간 앞뒤 글은 조항대로 남는다 — 선 문자는 화면에서 사라진다', () => {
    const rest = articles(splitContractBlocks(text))
    expect(rest.map((b) => b.heading)).toEqual(['제10조 (계약의 성립)', null])
    expect(rest.map((b) => b.body).join('\n')).not.toContain('─')
  })

  it('선이 없는 계약서(견적)는 통째로 글이다', () => {
    const quote = '제1조 목적\n견적서에 적은 대로 제공합니다.'
    expect(splitContractBlocks(quote).every((b) => !('items' in b))).toBe(true)
  })

  it('제목 없이 선만 있으면 손대지 않는다', () => {
    const odd = [BAR, '', BAR, 'a : 1', BAR, 'b : 2', BAR].join('\n')
    expect(splitContractBlocks(odd).every((b) => !('items' in b))).toBe(true)
  })
})
