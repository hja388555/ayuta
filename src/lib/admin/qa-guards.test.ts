import { describe, expect, it } from 'vitest'
import { z } from 'zod'
import { MAX_PRICE_AMOUNT, priceAmountProblem } from './price-limits'
import { issueField } from './issue-field'
import { buildOrderWhere, orderDetailHref, orderListBackHref, phoneSearchDigits, type OrderListParams } from './order-list-query'
import { requiresTransitionConfirm } from '../orders/transitions'
import { quoteIssueProblem } from '../quotes/lines'

const P = (over: Partial<OrderListParams> = {}): OrderListParams => ({ status: null, q: '', page: 1, period: 'all', ...over })

describe('priceAmountProblem — 단가 상한 10억', () => {
  it('0~10억 정수는 통과', () => {
    expect(priceAmountProblem('0')).toBeNull()
    expect(priceAmountProblem(String(MAX_PRICE_AMOUNT))).toBeNull()
    expect(priceAmountProblem(' 120000 ')).toBeNull()
  })
  it('10억 초과·정밀도를 잃는 큰 수는 too_large', () => {
    expect(priceAmountProblem('1000000001')).toBe('too_large')
    expect(priceAmountProblem('2147483648')).toBe('too_large')
    expect(priceAmountProblem('99999999999999999')).toBe('too_large')
  })
  it('빈칸·소수·음수는 invalid', () => {
    for (const v of ['', '1.5', '-1', 'abc']) expect(priceAmountProblem(v)).toBe('invalid')
  })
})

describe('quoteIssueProblem — 발행 상한', () => {
  it('정상 견적은 null', () => {
    expect(quoteIssueProblem([{ quantity: 999, unitAmount: 10_000_000 }])).toBeNull()
  })
  it('수량·금액·합계 상한을 실제 한도 문구로 알려준다', () => {
    expect(quoteIssueProblem([{ quantity: 1000, unitAmount: 1 }])).toContain('1~999')
    expect(quoteIssueProblem([{ quantity: 1, unitAmount: 1_000_000_001 }])).toContain('0~10억')
    expect(quoteIssueProblem([{ quantity: 999, unitAmount: 1_000_000_000 }])).toContain('100억')
    expect(quoteIssueProblem([{ quantity: 1, unitAmount: 0 }])).toContain('0원보다')
  })
})

describe('requiresTransitionConfirm — 되돌릴 수 없는 전이', () => {
  it('끝 상태(취소·결제실패·이상거래·완료)는 확인이 필요하다', () => {
    for (const s of ['cancelled', 'failed', 'fraud_suspected', 'done'] as const) expect(requiresTransitionConfirm(s)).toBe(true)
  })
  it('다음 전이가 남은 상태는 확인 없이 바꾼다', () => {
    for (const s of ['paid', 'in_progress'] as const) expect(requiresTransitionConfirm(s)).toBe(false)
  })
})

describe('phoneSearchDigits — 연락처 검색 정규화', () => {
  it('하이픈·공백이 있어도 숫자만 남긴다', () => {
    expect(phoneSearchDigits('010-1234-5678')).toBe('01012345678')
    expect(phoneSearchDigits('010 1234 5678')).toBe('01012345678')
    expect(phoneSearchDigits('01012345678')).toBe('01012345678')
  })
  it('주문번호·이름·짧은 숫자는 연락처 검색으로 보지 않는다', () => {
    expect(phoneSearchDigits('AY-2026-0001')).toBeNull()
    expect(phoneSearchDigits('홍길동')).toBeNull()
    expect(phoneSearchDigits('12')).toBeNull()
  })
  it('찾아 둔 id 는 검색 or 조건에 붙고, 없으면 붙지 않는다', () => {
    expect(JSON.stringify(buildOrderWhere(P({ q: '010' }), { phoneOrderIds: [3, 5] }))).toContain('"in":[3,5]')
    expect(JSON.stringify(buildOrderWhere(P({ q: '010' }), { phoneOrderIds: [] }))).not.toContain('"id"')
  })
})

describe('orderListBackHref — 목록으로 주소', () => {
  it('주문 목록 경로와 쿼리만 받는다', () => {
    expect(orderListBackHref('/manage/orders?status=paid&page=2')).toBe('/manage/orders?status=paid&page=2')
    expect(orderListBackHref('/manage/orders')).toBe('/manage/orders')
  })
  it('다른 경로·외부 주소·조작된 값은 기본 목록', () => {
    for (const bad of ['https://evil.test', '//evil.test', '/manage/orders//evil.test', '/manage/ordersX', '/manage/accounts', '/manage/orders?x=\\\\evil', undefined, ['/manage/orders']]) {
      expect(orderListBackHref(bad)).toBe('/manage/orders')
    }
  })
  it('상세 링크는 현재 목록 주소를 from 으로 싣는다', () => {
    expect(orderDetailHref(7, '/manage/orders')).toBe('/manage/orders/7')
    const href = orderDetailHref(7, '/manage/orders?q=a&page=2')
    expect(orderListBackHref(new URL(href, 'http://x').searchParams.get('from'))).toBe('/manage/orders?q=a&page=2')
  })
})

describe('issueField — 틀린 칸 이름', () => {
  it('첫 이슈의 경로를 점으로 잇고, 경로가 없으면 비운다', () => {
    const r = z.object({ email: z.string().email() }).safeParse({ email: 'x' })
    expect(r.success ? {} : issueField(r.error)).toEqual({ field: 'email' })
    const s = z.object({}).strict().safeParse({ extra: 1 })
    expect(s.success ? null : issueField(s.error)).toEqual({})
  })
})
