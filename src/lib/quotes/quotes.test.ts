import { describe, expect, it } from 'vitest'
import { generateQuoteToken, hashQuoteToken, isQuoteTokenShape, newQuoteNumber } from './token'
import { parseQuoteLines } from './lines'

describe('견적 토큰', () => {
  it('128bit 를 base64url 22자로 만든다 — URL 에 그대로 쓸 수 있다', () => {
    const t = generateQuoteToken()
    expect(t).toMatch(/^[A-Za-z0-9_-]{22}$/)
    expect(isQuoteTokenShape(t)).toBe(true)
  })

  it('매번 다르다', () => {
    const seen = new Set(Array.from({ length: 200 }, generateQuoteToken))
    expect(seen.size).toBe(200)
  })

  it('해시는 원문과 다르고 같은 입력에 같은 값이다', () => {
    const t = generateQuoteToken()
    expect(hashQuoteToken(t)).not.toContain(t)
    expect(hashQuoteToken(t)).toBe(hashQuoteToken(t))
    expect(hashQuoteToken(t)).toMatch(/^[0-9a-f]{64}$/)
  })

  it('모양이 틀린 값은 토큰으로 보지 않는다', () => {
    for (const v of ['', 'short', 'a'.repeat(23), '../../etc/passwd', 'aaaaaaaaaaaaaaaaaaaaa!']) expect(isQuoteTokenShape(v)).toBe(false)
  })

  it('견적번호는 Q-날짜-6자리', () => {
    expect(newQuoteNumber(new Date('2026-09-11T03:00:00Z'))).toMatch(/^Q-20260911-[0-9A-F]{6}$/)
  })
})

describe('parseQuoteLines — 서버 합계', () => {
  it('수량 × 단가를 더한다', () => {
    const r = parseQuoteLines([
      { label: '현수막 제작', quantity: 2, unitAmount: 150_000 },
      { label: '설치', quantity: 1, unitAmount: 50_000 },
    ])
    expect(r.ok && r.total).toBe(350_000)
  })

  it('항목명 공백·소수 금액·음수·수량 0·빈 목록은 거부한다', () => {
    const line = { label: '항목', quantity: 1, unitAmount: 1000 }
    for (const bad of [
      [{ ...line, label: '   ' }],
      [{ ...line, unitAmount: 1000.5 }],
      [{ ...line, unitAmount: -1 }],
      [{ ...line, quantity: 0 }],
      [{ ...line, quantity: 1.5 }],
      [],
    ]) expect(parseQuoteLines(bad).ok).toBe(false)
  })

  it('합계 0원 견적은 거부한다 — 결제할 것이 없다', () => {
    expect(parseQuoteLines([{ label: '무료 상담', quantity: 1, unitAmount: 0 }]).ok).toBe(false)
  })

  it('숫자 문자열은 받지 않는다 — 화면이 숫자로 보내야 한다', () => {
    expect(parseQuoteLines([{ label: '항목', quantity: '1', unitAmount: '1000' }]).ok).toBe(false)
  })
})
