import { describe, expect, it } from 'vitest'
import { ALLOWED_TRANSITIONS, availableTransitions, canTransition, statusLabel } from './transitions'
import { ORDER_STATUSES } from '../../collections/Orders'

describe('canTransition', () => {
  it('정상 경로를 허용한다', () => {
    expect(canTransition('pending', 'paid')).toBe(true)
    expect(canTransition('paid', 'in_progress')).toBe(true)
    expect(canTransition('in_progress', 'done')).toBe(true)
  })

  it('종료 상태에서는 아무 데도 못 간다', () => {
    for (const s of ['done', 'failed', 'cancelled', 'fraud_suspected'] as const) {
      expect(ALLOWED_TRANSITIONS[s]).toHaveLength(0)
    }
  })

  it('단계를 건너뛰거나 제자리로 가는 전이를 막는다', () => {
    expect(canTransition('pending', 'in_progress')).toBe(false)
    for (const s of ORDER_STATUSES) expect(canTransition(s, s)).toBe(false)
  })

  it('표에 없는 문자열은 거부한다', () => {
    expect(canTransition('pending', 'nonsense' as never)).toBe(false)
    expect(canTransition('nonsense' as never, 'paid')).toBe(false)
  })
})

describe('availableTransitions', () => {
  it('super 에게는 취소를 보여준다', () => {
    expect(availableTransitions('paid', { isSuper: true })).toContain('cancelled')
  })

  it('manager 에게는 취소를 감춘다 — API 가 403 을 내므로 버튼도 없어야 한다', () => {
    const options = availableTransitions('paid', { isSuper: false })
    expect(options).not.toContain('cancelled')
    expect(options).toContain('in_progress')
  })

  it('취소만 남는 상태에서 manager 는 고를 것이 없다', () => {
    expect(availableTransitions('in_progress', { isSuper: false })).toEqual(['done'])
  })

  it('종료 상태는 권한과 무관하게 비어 있다', () => {
    expect(availableTransitions('done', { isSuper: true })).toEqual([])
    expect(availableTransitions('cancelled', { isSuper: true })).toEqual([])
  })

  it('돌려주는 후보는 전부 canTransition 을 통과한다', () => {
    for (const from of ORDER_STATUSES) {
      for (const to of availableTransitions(from, { isSuper: true })) {
        expect(canTransition(from, to)).toBe(true)
      }
    }
  })
})

describe('statusLabel', () => {
  it('모든 상태에 한국어 표기가 있다', () => {
    for (const s of ORDER_STATUSES) expect(statusLabel(s)).not.toBe(s)
  })

  it('모르는 값은 그대로 돌려준다', () => {
    expect(statusLabel('무엇')).toBe('무엇')
  })
})
