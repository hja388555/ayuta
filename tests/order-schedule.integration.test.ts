// setOrderSchedule 의 핵심은 "UPDATE 와 이력 INSERT 가 한 트랜잭션"과 "안 바뀌었으면
// 기록하지 않는다" 두 가지다 — 둘 다 raw SQL 위에서만 성립하므로 실행 중인 DB 앞에서
// 확인한다. 단위 테스트(src/lib/orders/schedule.test.ts)는 판정 로직만 본다.
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import type { Where } from 'payload'
import { localPayload } from './helpers/localApi.js'
import { setOrderSchedule } from '../src/lib/orders/schedule'

const RUN = Date.now()
const uid = () => Math.random().toString(36).slice(2, 8)

let managerId: number
let orderId: number

const countChanges = async (field?: string) => {
  const payload = await localPayload()
  const where: Where = field
    ? { and: [{ order: { equals: orderId } }, { field: { equals: field } }] }
    : { order: { equals: orderId } }
  const { totalDocs } = await payload.find({
    collection: 'order-schedule-changes',
    where,
    overrideAccess: true,
    limit: 0,
  })
  return totalDocs
}

beforeAll(async () => {
  const payload = await localPayload()
  const manager = await payload.create({
    collection: 'users',
    data: {
      email: `schedmgr+${RUN}@ayuta.test`,
      password: 'Ayuta!Test-2026',
      name: '홍길동',
      phone: '010-0000-0000',
      postalCode: '00000',
      address1: '서울시',
      role: 'manager',
    },
    overrideAccess: true,
    context: { allowRoleAssignment: true },
  })
  managerId = manager.id as number

  const order = await payload.create({
    collection: 'orders',
    overrideAccess: true,
    data: {
      orderNumber: `AY-SCHED-${RUN}-${uid()}`,
      paymentId: `pay-sched-${RUN}-${uid()}`,
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
  const { docs } = await payload.find({
    collection: 'order-schedule-changes',
    where: { order: { equals: orderId } },
    overrideAccess: true,
    limit: 100,
  })
  for (const doc of docs) {
    try {
      await payload.delete({ collection: 'order-schedule-changes', id: doc.id, overrideAccess: true })
    } catch (err) {
      errors.push(`order-schedule-changes id=${doc.id}: ${err instanceof Error ? err.message : String(err)}`)
    }
  }
  for (const [collection, id] of [['orders', orderId], ['users', managerId]] as const) {
    try {
      await payload.delete({ collection, id, overrideAccess: true })
    } catch (err) {
      errors.push(`${collection} id=${id}: ${err instanceof Error ? err.message : String(err)}`)
    }
  }
  if (errors.length > 0) throw new Error(`테스트 데이터 정리 실패:\n${errors.join('\n')}`)
})

describe('setOrderSchedule', () => {
  it('광고시작일을 처음 정하면 이력이 1행 남는다', async () => {
    const res = await setOrderSchedule(orderId, { adStartDate: '2026-10-01' }, managerId)
    expect(res).toEqual({ ok: true, changed: ['adStartDate'] })
    expect(await countChanges('adStartDate')).toBe(1)

    const payload = await localPayload()
    const order = await payload.findByID({ collection: 'orders', id: orderId, overrideAccess: true })
    // Asia/Seoul 자정으로 저장된다 — UTC 로는 전날 15:00
    expect(new Date(order.adStartDate!).toISOString()).toBe('2026-09-30T15:00:00.000Z')
  })

  it('같은 값을 다시 저장하면 이력이 늘지 않는다', async () => {
    const before = await countChanges()
    const res = await setOrderSchedule(orderId, { adStartDate: '2026-10-01' }, managerId)
    expect(res).toEqual({ ok: true, changed: [] })
    expect(await countChanges()).toBe(before)
  })

  it('이력에 바꾼 사람과 이전·이후 값이 남는다', async () => {
    const res = await setOrderSchedule(orderId, { adStartDate: '2026-10-05' }, managerId)
    expect(res).toEqual({ ok: true, changed: ['adStartDate'] })

    const payload = await localPayload()
    const { docs } = await payload.find({
      collection: 'order-schedule-changes',
      where: { and: [{ order: { equals: orderId } }, { field: { equals: 'adStartDate' } }] },
      sort: '-at',
      limit: 1,
      overrideAccess: true,
    })
    const latest = docs[0]!
    expect(latest.fromValue).toBe('2026-10-01')
    expect(latest.toValue).toBe('2026-10-05')
    const actor = latest.actor
    expect(typeof actor === 'object' && actor !== null ? actor.id : actor).toBe(managerId)
  })

  it('계약기간 두 필드를 함께 정하면 이력이 2행 남는다', async () => {
    const before = await countChanges()
    const res = await setOrderSchedule(orderId, { contractStart: '2026-10-01', contractEnd: '2027-09-30' }, managerId)
    expect(res.ok && res.changed.sort()).toEqual(['contractEnd', 'contractStart'])
    expect(await countChanges()).toBe(before + 2)
  })

  it('종료일이 시작일보다 앞서면 거부하고 아무것도 남기지 않는다', async () => {
    const before = await countChanges()
    const res = await setOrderSchedule(orderId, { contractEnd: '2026-01-01' }, managerId)
    expect(res).toMatchObject({ ok: false, reason: 'reversed_period' })
    expect(await countChanges()).toBe(before)

    const payload = await localPayload()
    const order = await payload.findByID({ collection: 'orders', id: orderId, overrideAccess: true })
    expect(new Date(order.contractEnd!).toISOString()).toBe('2027-09-29T15:00:00.000Z')
  })

  it('없는 주문은 not_found 다', async () => {
    const res = await setOrderSchedule(2_000_000_000, { adStartDate: '2026-10-01' }, managerId)
    expect(res).toEqual({ ok: false, reason: 'not_found' })
  })

  it('계약서 스냅샷은 그대로다', async () => {
    const payload = await localPayload()
    const order = await payload.findByID({ collection: 'orders', id: orderId, overrideAccess: true })
    expect(order.contractText).toBe('테스트용 계약서 전문')
  })
})
