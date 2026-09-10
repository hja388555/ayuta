import { describe, expect, it } from 'vitest'
import { elapsedDays, quoteRefund, refundRate } from './refund'
import { minor } from './types/index'

const kst = (s: string) => new Date(`${s}+09:00`)

describe('경과일', () => {
  it('같은 날은 0일이다', () => {
    expect(elapsedDays(kst('2026-09-10T00:00'), kst('2026-09-10T23:59'))).toBe(0)
  })

  it('자정을 넘기면 1일이다 — 시각이 아니라 날짜로 센다', () => {
    expect(elapsedDays(kst('2026-09-10T23:00'), kst('2026-09-11T01:00'))).toBe(1)
  })

  it('광고 시작 전 신청은 음수다', () => {
    expect(elapsedDays(kst('2026-09-20T00:00'), kst('2026-09-10T00:00'))).toBe(-10)
  })

  it('한국 시간 기준이다 — UTC 로 세면 하루가 어긋난다', () => {
    // UTC 2026-09-10 15:30 = KST 2026-09-11 00:30
    expect(elapsedDays(kst('2026-09-10T00:00'), new Date('2026-09-10T15:30:00Z'))).toBe(1)
  })
})

describe('공제율', () => {
  it('시작 당일은 10%다', () => {
    expect(refundRate(0)).toBe(10)
  })

  it('하루에 10%씩 늘어난다', () => {
    expect(refundRate(1)).toBe(20)
    expect(refundRate(4)).toBe(50)
  })

  it('100%를 넘지 않는다', () => {
    expect(refundRate(9)).toBe(100)
    expect(refundRate(100)).toBe(100)
  })

  it('시작 전이면 0%다', () => {
    expect(refundRate(-1)).toBe(0)
  })
})

describe('환불 견적', () => {
  it('공제금액은 내림한다 — 고객에게 1원 덜 주지 않는다', () => {
    const q = quoteRefund(minor(1_000_001), kst('2026-09-10T00:00'), kst('2026-09-10T12:00'))
    if ('deduction' in q) {
      // 1,000,001 × 10% = 100,000.1 → 100,000
      expect(q.deduction).toBe(100_000)
      expect(q.refundable).toBe(900_001)
      expect(q.deduction + q.refundable).toBe(1_000_001)
    }
  })

  it('광고 시작일이 없으면 미정을 돌려준다 — 0%로 가정하지 않는다', () => {
    const q = quoteRefund(minor(1_000_000), null, kst('2026-09-10T00:00'))
    expect(q).toEqual({ rate: 'undetermined' })
  })

  it('공제율 100%면 환불금액이 0이다', () => {
    const q = quoteRefund(minor(500_000), kst('2026-09-01T00:00'), kst('2026-09-30T00:00'))
    if ('refundable' in q) expect(q.refundable).toBe(0)
  })

  it('시작 전 취소는 전액 환불이다', () => {
    const q = quoteRefund(minor(500_000), kst('2026-09-20T00:00'), kst('2026-09-10T00:00'))
    if ('refundable' in q) expect(q.refundable).toBe(500_000)
  })

  it('합계가 결제금액과 항상 같다', () => {
    for (const d of [0, 1, 3, 5, 9, 20]) {
      const q = quoteRefund(minor(333_333), kst('2026-09-10T00:00'), new Date(kst('2026-09-10T00:00').getTime() + d * 86400000))
      if ('deduction' in q) expect(q.deduction + q.refundable).toBe(333_333)
    }
  })
})
