import { describe, expect, it } from 'vitest'
import { Orders } from './Orders'

// 필드 설정에서 이 테스트가 보는 두 부분만 꺼낸다 — Payload의 Field 유니온은 필드 종류마다
// admin/access 모양이 달라, 종류를 좁히지 않으면 타입 수준에서 접근할 수 없다
type Inspected = {
  admin?: { readOnly?: boolean }
  access?: { update?: (args: never) => boolean }
}

function fieldNamed(name: string): Inspected {
  const found = Orders.fields.find((f) => 'name' in f && f.name === name)
  if (!found) throw new Error(`orders 컬렉션에 ${name} 필드가 없다`)
  return found as Inspected
}

// 관리자가 목록에서 뭘 보고 뭘로 검색하는지 — 화면을 새로 만들지 않고 이 설정으로 대신한다
describe('주문 관리자 화면 설정', () => {
  it('주문번호를 제목으로 쓴다', () => {
    expect(Orders.admin?.useAsTitle).toBe('orderNumber')
  })

  it('목록 컬럼과 검색 필드가 지정돼 있다', () => {
    expect(Orders.admin?.defaultColumns).toEqual([
      'orderNumber',
      'status',
      'currency',
      'amount',
      'category',
      'createdAt',
    ])
    expect(Orders.admin?.listSearchableFields).toEqual(['orderNumber', 'paymentId'])
  })
})

describe('상태 필드 잠금', () => {
  const status = fieldNamed('status')

  it('admin UI에서 읽기전용이다', () => {
    expect(status.admin?.readOnly).toBe(true)
  })

  // 일반 저장으로 상태가 바뀌면 transitionOrder()의 원자적 전이·전이기록을 통째로 건너뛴다
  it('update를 거부한다', () => {
    expect(status.access?.update?.(undefined as never)).toBe(false)
  })
})

describe('스냅샷 불변 필드', () => {
  const names = [
    'contractText',
    'items',
    'contractItems',
    'amount',
    'signature',
    'orderer',
    'orderNumber',
    'currency',
    'category',
  ]

  it.each(names)('%s 는 update를 거부한다', (name) => {
    expect(fieldNamed(name).access?.update?.(undefined as never)).toBe(false)
  })
})

describe('잠그지 않은 필드', () => {
  // 관리자가 실제로 고칠 수 있어야 하는 운영 필드까지 같이 잠그면 admin 화면이 무용지물이 된다
  it.each(['paidAt', 'failReason', 'customer'])('%s 는 update 제한이 없다', (name) => {
    expect(fieldNamed(name).access?.update).toBeUndefined()
  })
})
