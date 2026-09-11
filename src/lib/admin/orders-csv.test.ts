import { describe, expect, it } from 'vitest'
import { buildOrdersCsv, csvCell, CSV_BOM } from './orders-csv'

describe('csvCell', () => {
  it('수식으로 시작하는 값은 따옴표 하나를 붙여 글자로 만든다', () => {
    expect(csvCell('=1+1')).toBe("'=1+1")
    expect(csvCell('+82')).toBe("'+82")
    expect(csvCell('-3')).toBe("'-3")
    expect(csvCell('@SUM(A1)')).toBe("'@SUM(A1)")
  })

  it('쉼표·따옴표·줄바꿈은 따옴표로 감싼다', () => {
    expect(csvCell('a,b')).toBe('"a,b"')
    expect(csvCell('say "hi"')).toBe('"say ""hi"""')
    expect(csvCell('=HYPERLINK("x")')).toBe('"\'=HYPERLINK(""x"")"')
  })

  it('평범한 값은 그대로', () => {
    expect(csvCell('홍길동')).toBe('홍길동')
  })
})

describe('buildOrdersCsv', () => {
  it('BOM·헤더·행을 만든다', () => {
    const csv = buildOrdersCsv([
      {
        orderNumber: 'AY-1',
        createdAt: '2026-09-18T05:32:00.000Z',
        orderer: { name: '=cmd', phone: '010', email: 'a@b.c', postcode: '1', address1: 'x' },
        category: 1,
        amount: 100000,
        currency: 'KRW',
        status: 'paid',
      },
    ])
    expect(csv.startsWith(CSV_BOM)).toBe(true)
    const lines = csv.slice(1).trim().split('\r\n')
    expect(lines[0]).toBe('주문번호,주문일,고객,서비스,금액,상태')
    expect(lines[1]).toContain("AY-1")
    expect(lines[1]).toContain("'=cmd")
    expect(lines[1]).toContain('1. 디지털 / SNS 광고')
    expect(lines[1]).toContain('결제완료')
    expect(csv).not.toContain('010')
  })
})
