import { describe, expect, it } from 'vitest'
import { dayKey, formatOrderNumber, parseOrderNumber } from './order-number'

describe('주문번호 형식', () => {
  it('AY-YYYYMMDD-NNNN 으로 만든다', () => {
    expect(formatOrderNumber('AY', new Date('2026-09-18T01:00:00+09:00'), 1)).toBe('AY-20260918-0001')
    expect(formatOrderNumber('QT', new Date('2026-09-18T01:00:00+09:00'), 42)).toBe('QT-20260918-0042')
  })

  it('날짜는 한국 시간 기준이다', () => {
    // UTC 2026-09-17 15:30 = KST 2026-09-18 00:30
    expect(dayKey(new Date('2026-09-17T15:30:00Z'))).toBe('20260918')
    // UTC 2026-09-17 14:30 = KST 2026-09-17 23:30
    expect(dayKey(new Date('2026-09-17T14:30:00Z'))).toBe('20260917')
  })

  it('9999를 넘으면 자리수를 늘린다', () => {
    expect(formatOrderNumber('AY', new Date('2026-09-18T01:00:00+09:00'), 10000)).toBe('AY-20260918-10000')
  })

  it('순번이 1 미만이면 거부한다', () => {
    expect(() => formatOrderNumber('AY', new Date(), 0)).toThrow()
  })

  it('되읽을 수 있다', () => {
    expect(parseOrderNumber('AY-20260918-0001')).toEqual({ scope: 'AY', day: '20260918', seq: 1 })
    expect(parseOrderNumber('INQ-20260101-0123')).toEqual({ scope: 'INQ', day: '20260101', seq: 123 })
  })

  it('형식이 다르면 null 이다', () => {
    for (const bad of ['AY-2026918-0001', 'XX-20260918-0001', 'AY-20260918', '', 'AY-20260918-abcd']) {
      expect(parseOrderNumber(bad)).toBeNull()
    }
  })
})
