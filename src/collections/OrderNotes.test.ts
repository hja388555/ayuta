import { describe, expect, it } from 'vitest'
import { OrderNotes } from './OrderNotes'

const access = OrderNotes.access!
const req = (role: string | null) => ({ req: { user: role ? { role } : null } }) as never

describe('order-notes 접근 권한', () => {
  it('관리자만 읽는다', () => {
    expect(access.read!(req('manager'))).toBe(true)
    expect(access.read!(req('super'))).toBe(true)
    expect(access.read!(req('customer'))).toBe(false)
    expect(access.read!(req(null))).toBe(false)
  })

  it('관리자만 만든다', () => {
    expect(access.create!(req('manager'))).toBe(true)
    expect(access.create!(req('super'))).toBe(true)
    expect(access.create!(req('customer'))).toBe(false)
    expect(access.create!(req(null))).toBe(false)
  })

  // append-only 감사 기록: 누구도 고치거나 지울 수 없다
  it('수정·삭제·잠금해제는 super에게도 닫혀 있다', () => {
    expect(access.update!(req('super'))).toBe(false)
    expect(access.delete!(req('super'))).toBe(false)
    expect(access.unlock!(req('super'))).toBe(false)
  })

  it('관리자만 admin UI에 들어간다', () => {
    expect(access.admin!(req('manager'))).toBe(true)
    expect(access.admin!(req('customer'))).toBe(false)
  })
})

describe('author 강제', () => {
  const hook = OrderNotes.hooks!.beforeChange![0] as (args: never) => { author: unknown }
  const run = (data: Record<string, unknown>, user: unknown) =>
    hook({ data, req: { user } } as never)

  it('클라이언트가 보낸 author를 로그인 사용자로 덮어쓴다', () => {
    expect(run({ body: '통화함', author: 999 }, { id: 7 }).author).toBe(7)
  })

  it('author를 안 보내도 로그인 사용자로 채운다', () => {
    expect(run({ body: '통화함' }, { id: 7 }).author).toBe(7)
  })

  it('요청에 사용자가 없으면 author를 비운다 — 보낸 값을 물려받지 않는다', () => {
    expect(run({ body: '통화함', author: 999 }, null).author).toBe(null)
  })

  it('다른 필드는 그대로 둔다', () => {
    expect(run({ body: '통화함', order: 3 }, { id: 7 })).toMatchObject({ body: '통화함', order: 3 })
  })
})

describe('필드 정의', () => {
  const field = (name: string) => {
    const f = OrderNotes.fields.find((x) => 'name' in x && x.name === name)
    if (!f) throw new Error(`order-notes 컬렉션에 ${name} 필드가 없다`)
    return f as { type: string; required?: boolean; index?: boolean; validate?: (v: unknown) => unknown }
  }

  it('order는 필수 relationship이고 인덱스가 있다', () => {
    const order = field('order')
    expect(order.type).toBe('relationship')
    expect(order.required).toBe(true)
    expect(order.index).toBe(true)
  })

  it('body는 필수 textarea다', () => {
    expect(field('body').type).toBe('textarea')
    expect(field('body').required).toBe(true)
  })

  it('body의 빈 문자열·공백만은 거부한다', () => {
    const validate = field('body').validate!
    expect(validate('통화 완료')).toBe(true)
    expect(validate('')).not.toBe(true)
    expect(validate('   ')).not.toBe(true)
    expect(validate('\n\t')).not.toBe(true)
  })

  it('author는 users relationship이다', () => {
    expect(field('author').type).toBe('relationship')
  })
})
