import { describe, expect, it } from 'vitest'
import { blocksToText, headingsOf, parseLegal } from './parse'
import { PRIVACY_KO_BODY } from './privacy-draft'

describe('개인정보 처리방침 초안(ko)', () => {
  const blocks = parseLegal(PRIVACY_KO_BODY)

  it('제1조~제14조가 순서대로 조 제목으로 읽힌다(목록 번호가 제목으로 섞이지 않는다)', () => {
    expect(headingsOf(blocks).map((h) => h.num)).toEqual(Array.from({ length: 14 }, (_, i) => String(i + 1)))
  })

  it('마크다운 기호와 팀 내부 메모가 남지 않는다', () => {
    expect(PRIVACY_KO_BODY).not.toMatch(/\*\*|^#|^>|`|확인 필요/m)
  })

  it('표(보유 기간·위탁·국외 이전 등)가 표로 읽힌다', () => {
    expect(blocks.filter((b) => b.type === 'table').length).toBeGreaterThanOrEqual(6)
  })

  it('원문을 한 글자도 잃지 않는다', () => {
    expect(blocksToText(blocks)).toBe(PRIVACY_KO_BODY)
  })
})
