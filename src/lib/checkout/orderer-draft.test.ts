import { describe, expect, it } from 'vitest'
import { clearOrdererDraft, ordererDraftKey, readOrdererDraft, writeOrdererDraft } from './orderer-draft'

const memory = () => {
  const m = new Map<string, string>()
  return { getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => void m.set(k, v), removeItem: (k: string) => void m.delete(k), m }
}

describe('결제 화면 주문자 입력 임시 저장', () => {
  it('카테고리마다 따로 저장하고 읽는다', () => {
    const s = memory()
    writeOrdererDraft(s, 'transit', { name: '홍길동', phone: '01012345678', email: 'a@b.co' })
    expect(readOrdererDraft(s, 'transit')).toEqual({ name: '홍길동', phone: '01012345678', email: 'a@b.co' })
    expect(readOrdererDraft(s, 'digital-sns')).toBeNull()
  })

  it('동의·서명 같은 다른 값은 저장하지도 읽지도 않는다', () => {
    const s = memory()
    writeOrdererDraft(s, 'transit', { name: '홍길동', signature: '홍길동', consents: 'x' } as Record<string, string>)
    expect(JSON.parse(s.m.get(ordererDraftKey('transit'))!)).toEqual({ name: '홍길동' })
    s.setItem(ordererDraftKey('transit'), JSON.stringify({ name: '김', signature: '김', agree: true }))
    expect(readOrdererDraft(s, 'transit')).toEqual({ name: '김' })
  })

  it('깨진 값·빈 초안·저장소 오류는 null 이고 던지지 않는다', () => {
    const s = memory()
    s.setItem(ordererDraftKey('transit'), '{oops')
    expect(readOrdererDraft(s, 'transit')).toBeNull()
    writeOrdererDraft(s, 'transit', { name: '' })
    expect(readOrdererDraft(s, 'transit')).toBeNull()
    const broken = { getItem: () => { throw new Error('denied') }, setItem: () => { throw new Error('denied') }, removeItem: () => { throw new Error('denied') } }
    expect(readOrdererDraft(broken, 'transit')).toBeNull()
    expect(() => writeOrdererDraft(broken, 'transit', { name: 'a' })).not.toThrow()
    expect(() => clearOrdererDraft(broken, 'transit')).not.toThrow()
    expect(readOrdererDraft(undefined, 'transit')).toBeNull()
  })

  it('주문 뒤 지우면 다시 읽히지 않는다', () => {
    const s = memory()
    writeOrdererDraft(s, 'transit', { name: '홍길동' })
    clearOrdererDraft(s, 'transit')
    expect(readOrdererDraft(s, 'transit')).toBeNull()
  })
})
