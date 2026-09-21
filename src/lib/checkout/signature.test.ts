import { describe, expect, it } from 'vitest'
import { signatureMatches } from './signature'

describe('signatureMatches', () => {
  it('같은 이름이면 통과한다', () => {
    expect(signatureMatches('황지원', '황지원')).toBe(true)
  })
  it('조합형(NFD)과 완성형(NFC)이 섞여도 통과한다', () => {
    expect(signatureMatches('황지원'.normalize('NFD'), '황지원'.normalize('NFC'))).toBe(true)
  })
  it('공백과 보이지 않는 글자는 무시한다', () => {
    expect(signatureMatches(' 황 지원 ', '황지원')).toBe(true)
    expect(signatureMatches('황지원​', '황지원')).toBe(true)
  })
  it('빈 값이거나 다른 이름이면 막는다', () => {
    expect(signatureMatches('', '황지원')).toBe(false)
    expect(signatureMatches('   ', '황지원')).toBe(false)
    expect(signatureMatches('김지원', '황지원')).toBe(false)
  })
})
