import { describe, expect, it } from 'vitest'
import { DEFAULT_PERIOD_MULTIPLIERS, MAX_MULTIPLIER, multiplierError, PERIOD_KEYS, PricingSettings } from './PricingSettings'
import { formFor } from '../lib/category-groups'

describe('multiplierError — 기간 배수 입력 규칙', () => {
  it('양수·소수 둘째 자리까지는 받는다', () => {
    for (const v of [1, 1.8, 3, 8, 0.5, 1.15, MAX_MULTIPLIER]) expect(multiplierError(v)).toBeNull()
  })

  it('0·음수·상한 초과는 거부한다', () => {
    expect(multiplierError(0)).not.toBeNull()
    expect(multiplierError(-1)).not.toBeNull()
    expect(multiplierError(MAX_MULTIPLIER + 0.01)).not.toBeNull()
  })

  it('소수 셋째 자리는 거부한다 — 계산기가 × 100 정수 연산을 한다', () => {
    expect(multiplierError(1.125)).not.toBeNull()
  })

  it('숫자가 아니면 거부한다', () => {
    for (const v of [null, undefined, '1.8', Number.NaN, Number.POSITIVE_INFINITY]) expect(multiplierError(v)).not.toBeNull()
  })
})

describe('pricing-settings 정의', () => {
  it('기간 키가 4번 폼의 periods 와 같다 — 한쪽만 늘리면 고를 수 있는데 배수가 없는 기간이 생긴다', () => {
    expect([...PERIOD_KEYS]).toEqual(formFor(4)?.periods)
  })

  it('기본값이 전부 규칙을 통과한다', () => {
    for (const k of PERIOD_KEYS) expect(multiplierError(DEFAULT_PERIOD_MULTIPLIERS[k])).toBeNull()
  })

  it('필드 validate 가 기본 required 검증을 먼저 돌린다 (빈 값 거부)', () => {
    const group = PricingSettings.fields[0] as { fields: Array<{ validate: (v: unknown, o: unknown) => unknown }> }
    const validate = group.fields[0]!.validate
    const options = { req: { t: (k: string) => k }, required: true }
    expect(validate(null, options)).not.toBe(true)
    expect(validate(1.8, options)).toBe(true)
    expect(validate(1.125, options)).not.toBe(true)
  })
})
