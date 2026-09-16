import { describe, expect, it } from 'vitest'
import { nextItemKey } from './item-key'

// 항목 키는 만든 뒤 못 바꾼다(단가·주문 스냅샷이 이 키로 서로를 찾는다).
// 그래서 관리자가 직접 입력하지 않고 서버가 정해진 규칙으로 만든다.
describe('항목 키 생성', () => {
  it('서비스 번호와 묶음 키로 만든다', () => {
    expect(nextItemKey(6, 'spot', [])).toBe('s6-spot-1')
  })

  it('이미 쓰는 번호는 건너뛴다', () => {
    expect(nextItemKey(6, 'spot', ['s6-spot-1', 's6-spot-2'])).toBe('s6-spot-3')
  })

  it('중간이 비어 있어도 가장 큰 번호 다음을 쓴다', () => {
    // 지워진 키를 다시 쓰면 옛 주문 스냅샷과 새 항목이 같은 이름을 갖게 된다
    expect(nextItemKey(6, 'spot', ['s6-spot-1', 's6-spot-5'])).toBe('s6-spot-6')
  })

  it('금지 문자가 들어간 묶음 키는 안전하게 바꾼다', () => {
    // 키에 __ 를 쓰면 안 된다 — 주문 스냅샷이 키를 이어 붙일 때 경계를 잃는다
    expect(nextItemKey(7, 'a__b', [])).toBe('s7-a-b-1')
  })

  it('대문자·공백·한글은 떨어내고 하이픈으로 잇는다', () => {
    expect(nextItemKey(8, 'Ad Spot 옥외', [])).toBe('s8-ad-spot-1')
  })

  it('쓸 글자가 하나도 없는 묶음 키는 g 로 대신한다', () => {
    expect(nextItemKey(9, '옥외', [])).toBe('s9-g-1')
  })

  it('다른 묶음의 키는 번호 계산에 끼지 않는다', () => {
    expect(nextItemKey(6, 'spot', ['s6-size-1', 's6-size-2'])).toBe('s6-spot-1')
  })
})
