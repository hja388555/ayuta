// order-notes 의 append-only 성질과 author 강제는 Payload 훅·access rule 위에서만
// 성립한다 — 단위 테스트는 함수 반환값만 볼 뿐, 실제 create 경로가 그 규칙을 타는지는
// 확인하지 못한다. 그래서 실행 중인 DB 앞에서 한 번 더 못박는다.
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { localPayload } from './helpers/localApi.js'

const RUN = Date.now()
const uid = () => Math.random().toString(36).slice(2, 8)

let managerId: number
let customerId: number
let otherAdminId: number
let orderId: number
const noteIds: number[] = []

beforeAll(async () => {
  const payload = await localPayload()
  const base = { name: '홍길동', phone: '010-0000-0000', postalCode: '00000', address1: '서울시' }
  const mkUser = async (role: 'manager' | 'customer', tag: string) => {
    const u = await payload.create({
      collection: 'users',
      data: { email: `${tag}+${RUN}@ayuta.test`, password: 'Ayuta!Test-2026', ...base, role },
      overrideAccess: true,
      context: { allowRoleAssignment: true },
    })
    return u.id as number
  }
  managerId = await mkUser('manager', 'notemgr')
  otherAdminId = await mkUser('manager', 'noteother')
  customerId = await mkUser('customer', 'notecust')

  const order = await payload.create({
    collection: 'orders',
    overrideAccess: true,
    data: {
      orderNumber: `AY-NOTE-${RUN}-${uid()}`,
      paymentId: `pay-note-${RUN}-${uid()}`,
      status: 'paid',
      currency: 'KRW',
      amount: 100_000,
      locale: 'ko',
      category: 1,
      items: [{ code: 'standard', label: '스탠다드', unitAmount: 100_000, quantity: 1 }],
      contractItems: [{ label: '등급', value: '스탠다드' }],
      orderer: {
        name: '홍길동',
        phone: '010-1234-5678',
        email: 'hong@example.com',
        postcode: '12345',
        address1: '서울특별시 동대문구 답십리동 323',
      },
      signature: '홍길동',
      contractText: '테스트용 계약서 전문',
    },
  })
  orderId = order.id as number
})

afterAll(async () => {
  const payload = await localPayload()
  const errors: string[] = []
  const drop = async (collection: 'order-notes' | 'orders' | 'users', id: number) => {
    try {
      await payload.delete({ collection, id, overrideAccess: true })
    } catch (err) {
      errors.push(`${collection} id=${id}: ${err instanceof Error ? err.message : String(err)}`)
    }
  }
  for (const id of noteIds) await drop('order-notes', id)
  await drop('orders', orderId)
  for (const id of [managerId, otherAdminId, customerId]) await drop('users', id)
  // 정리 실패를 삼키면 재실행 가능성이 조용히 깨진다
  if (errors.length > 0) throw new Error(`테스트 데이터 정리 실패:\n${errors.join('\n')}`)
})

const asUser = (id: number, role: string, email: string) =>
  ({ id, role, email, collection: 'users' }) as never

describe('관리자 연락메모', () => {
  it('manager는 메모를 남길 수 있다', async () => {
    const payload = await localPayload()
    const note = await payload.create({
      collection: 'order-notes',
      overrideAccess: false,
      user: asUser(managerId, 'manager', `notemgr+${RUN}@ayuta.test`),
      data: { order: orderId, body: '고객 통화 완료 — 광고 시작일 협의 중' },
    })
    noteIds.push(note.id as number)
    expect(note.body).toBe('고객 통화 완료 — 광고 시작일 협의 중')
    expect(note.createdAt).toBeTruthy()
  })

  it('customer는 메모를 남길 수 없다', async () => {
    const payload = await localPayload()
    await expect(
      payload.create({
        collection: 'order-notes',
        overrideAccess: false,
        user: asUser(customerId, 'customer', `notecust+${RUN}@ayuta.test`),
        data: { order: orderId, body: '고객이 직접 남긴 메모' },
      }),
    ).rejects.toThrow()
  })

  it('customer는 메모를 읽을 수 없다', async () => {
    const payload = await localPayload()
    await expect(
      payload.find({
        collection: 'order-notes',
        overrideAccess: false,
        user: asUser(customerId, 'customer', `notecust+${RUN}@ayuta.test`),
        where: { order: { equals: orderId } },
      }),
    ).rejects.toThrow()
  })

  it('author를 위조해서 보내도 로그인한 관리자로 저장된다', async () => {
    const payload = await localPayload()
    const note = await payload.create({
      collection: 'order-notes',
      overrideAccess: false,
      user: asUser(managerId, 'manager', `notemgr+${RUN}@ayuta.test`),
      // 다른 관리자 이름으로 기록을 남기려는 시도
      data: { order: orderId, body: '위조 시도', author: otherAdminId },
    })
    noteIds.push(note.id as number)
    const author = note.author
    expect(typeof author === 'object' && author !== null ? author.id : author).toBe(managerId)
  })

  it('빈 메모는 거부한다', async () => {
    const payload = await localPayload()
    await expect(
      payload.create({
        collection: 'order-notes',
        overrideAccess: false,
        user: asUser(managerId, 'manager', `notemgr+${RUN}@ayuta.test`),
        data: { order: orderId, body: '   ' },
      }),
    ).rejects.toThrow()
  })

  it('남긴 메모는 수정할 수 없다', async () => {
    const payload = await localPayload()
    await expect(
      payload.update({
        collection: 'order-notes',
        id: noteIds[0]!,
        overrideAccess: false,
        user: asUser(managerId, 'manager', `notemgr+${RUN}@ayuta.test`),
        data: { body: '내용을 바꾼다' },
      }),
    ).rejects.toThrow()
  })

  it('남긴 메모는 삭제할 수 없다', async () => {
    const payload = await localPayload()
    await expect(
      payload.delete({
        collection: 'order-notes',
        id: noteIds[0]!,
        overrideAccess: false,
        user: asUser(managerId, 'manager', `notemgr+${RUN}@ayuta.test`),
      }),
    ).rejects.toThrow()
  })
})
