// 나라별 연락처(한국 +82 · 일본 +81)를 실제 서버·DB 앞에서 고정한다:
// 가입·문의·비회원 채팅이 틀린 번호를 거절하는지, 저장은 E.164 인지, 계약서 표기, 비회원 주문 조회·관리자 연락처 검색이
// E.164 저장값과 예전 형식(010-1234-5678) 저장값을 함께 찾는지.
import { afterAll, describe, expect, it } from 'vitest'
// localApi 를 먼저 — .env 를 읽기 전에 payload config 를 가져오면 "missing secret key"
import { localPayload } from './helpers/localApi.js'
import { BASE, api } from './helpers/server.js'
import { createOrder } from '../src/lib/checkout/create-order'
import { findOwnedOrder } from '../src/lib/order-lookup'
import { phoneSearchDigits } from '../src/lib/admin/order-list-query'

const RUN = Date.now()
const PW = 'Ayuta!Test-2026'
const userIds: number[] = []
const orderIds: number[] = []
const inquiryIds: number[] = []
let ipSeq = 0
const freshIp = () => `10.${(RUN % 200) + 1}.${Math.floor(RUN / 1000) % 250}.${200 + ++ipSeq}`

const userByEmail = async (email: string) => {
  const payload = await localPayload()
  const { docs } = await payload.find({ collection: 'users', where: { email: { equals: email } }, limit: 1, overrideAccess: true })
  return docs[0]
}

afterAll(async () => {
  const payload = await localPayload()
  const pool = payload.db.pool
  for (const id of orderIds) await payload.delete({ collection: 'orders', id, overrideAccess: true }).catch(() => {})
  const threads = `SELECT id FROM chat_threads WHERE guest_email LIKE $1`
  await pool.query(`DELETE FROM chat_messages WHERE thread_id IN (${threads})`, [`%+${RUN}@ayuta.test`])
  await pool.query(`DELETE FROM chat_threads WHERE id IN (${threads})`, [`%+${RUN}@ayuta.test`])
  for (const id of inquiryIds) await pool.query('DELETE FROM inquiries WHERE id = $1', [id])
  for (const id of userIds) await payload.delete({ collection: 'users', id, overrideAccess: true }).catch(() => {})
})

describe('회원가입 연락처', () => {
  const body = (email: string, phone: string) => ({
    email,
    password: PW,
    name: '가입자',
    phone,
    postalCode: '12345',
    address1: '서울시 동대문구',
    agreeAge: true,
    agreeTerms: true,
    agreePrivacy: true,
  })
  const signup = (email: string, phone: string) => api('/api/signup', { method: 'POST', body: JSON.stringify(body(email, phone)) })

  it.each(['010-12', '012-1234-5678', '+81 10-1234-5678', '+82 90-1234-5678', 'abc'])('%s 는 400 invalid_phone 이고 계정이 생기지 않는다', async (phone) => {
    const email = `phone-bad-${phone.replace(/\W/g, '')}+${RUN}@ayuta.test`
    const res = await signup(email, phone)
    expect(res.status).toBe(400)
    expect(await res.json()).toEqual({ error: 'invalid_phone' })
    expect(await userByEmail(email)).toBeUndefined()
  })

  it.each([
    ['010-7777-1234', '+821077771234'],
    ['+81 90-1234-5678', '+819012345678'],
    ['+819012345678', '+819012345678'],
    // 국가번호 없이 온 일본 번호(예전 화면)도 한국 규칙에 안 맞으면 일본 번호로 받는다
    ['080-2222-3333', '+818022223333'],
  ])('%s 는 %s 로 저장된다', async (phone, stored) => {
    const email = `phone-ok-${stored.slice(1)}-${phone.length}+${RUN}@ayuta.test`
    const res = await signup(email, phone)
    expect(res.status).toBe(200)
    const u = await userByEmail(email)
    userIds.push(u!.id as number)
    expect(u!.phone).toBe(stored)
  })
})

describe('결제 주문자 연락처', () => {
  const input = (phone: string, locale: 'ko' | 'ja' = 'ko') => ({
    categorySlug: 'digital-sns',
    locale,
    selection: { tiers: ['standard'], platforms: [], country: ['kr'] },
    consents: { agree: true },
    orderer: { name: `연락처테스트${RUN}`, phone, email: `phone-order-${RUN}@example.com`, postalCode: '12345', address1: '서울특별시 동대문구 답십리동 323' },
    signature: `연락처테스트${RUN}`,
  })

  it('한국 번호는 E.164 로 저장하고 계약서에는 010-1234-5678 로 적는다', async () => {
    const result = await createOrder(input('010-1234-5678'))
    expect(result.ok).toBe(true)
    if (!result.ok) return
    orderIds.push(result.orderId)
    const order = await (await localPayload()).findByID({ collection: 'orders', id: result.orderId, overrideAccess: true })
    expect(order.orderer.phone).toBe('+821012345678')
    expect(order.contractText).toContain('010-1234-5678')
    expect(order.contractText).not.toContain('+821012345678')
  })

  it('일본 번호는 계약서에 +81 90-1234-5678 로 적는다', async () => {
    const result = await createOrder(input('+81 90-1234-5678'))
    expect(result.ok).toBe(true)
    if (!result.ok) return
    orderIds.push(result.orderId)
    const order = await (await localPayload()).findByID({ collection: 'orders', id: result.orderId, overrideAccess: true })
    expect(order.orderer.phone).toBe('+819012345678')
    expect(order.contractText).toContain('+81 90-1234-5678')
  })

  it('어느 나라 규칙에도 맞지 않거나 국가번호와 번호가 어긋나면 거절한다', async () => {
    for (const phone of ['010-12', '012-1234-5678', '+81 10-1234-5678', '+82 90-1234-5678']) {
      expect(await createOrder(input(phone, 'ja'))).toMatchObject({ ok: false, reason: 'invalid_input' })
    }
  })
})

describe('비회원 주문 조회 · 관리자 연락처 검색', () => {
  const email = `phone-lookup-${RUN}@example.com`
  const legacyOrder = async (phone: string) => {
    const payload = await localPayload()
    const o = await payload.create({
      collection: 'orders',
      overrideAccess: true,
      data: {
        orderNumber: `AY-PH-${RUN}-${Math.random().toString(36).slice(2, 8)}`,
        paymentId: `pay-ph-${RUN}-${Math.random().toString(36).slice(2, 8)}`,
        status: 'pending',
        currency: 'KRW',
        amount: 100_000,
        locale: 'ko',
        category: 1,
        items: [{ code: 'standard', label: '스탠다드', unitAmount: 100_000, quantity: 1 }],
        contractItems: [{ label: '등급', value: '스탠다드' }],
        orderer: { name: '주문자', phone, email, postcode: '12345', address1: '서울' },
        signature: '주문자',
        contractText: '테스트용 계약서 전문',
      },
    })
    orderIds.push(o.id as number)
    return o
  }

  it('E.164 로 저장된 주문을 하이픈 번호로 연다', async () => {
    const o = await legacyOrder('+821055551234')
    for (const phone of ['010-5555-1234', '01055551234', '+82 10 5555 1234']) {
      expect((await findOwnedOrder(o.orderNumber, { kind: 'guest', email, phone }))?.id).toBe(o.id)
    }
    expect(await findOwnedOrder(o.orderNumber, { kind: 'guest', email, phone: '010-5555-1235' })).toBeNull()
  })

  it('예전 형식(010-5555-4321)으로 저장된 주문도 국가번호를 붙여 열린다', async () => {
    const o = await legacyOrder('010-5555-4321')
    for (const phone of ['+82 10-5555-4321', '01055554321']) {
      expect((await findOwnedOrder(o.orderNumber, { kind: 'guest', email, phone }))?.id).toBe(o.id)
    }
  })

  it('관리자 연락처 검색어가 E.164 저장값과 예전 값을 함께 찾는다', async () => {
    const e164 = await legacyOrder('+821066667777')
    const legacy = await legacyOrder('010-6666-7777')
    const payload = await localPayload()
    for (const q of ['010-6666-7777', '01066667777']) {
      const digits = phoneSearchDigits(q)!
      const { rows } = await payload.db.pool.query(
        `SELECT id FROM orders WHERE regexp_replace(orderer_phone, '[^0-9]', '', 'g') LIKE $1`,
        [`%${digits}%`],
      )
      const ids = rows.map((r: { id: number }) => Number(r.id))
      expect(ids).toEqual(expect.arrayContaining([e164.id, legacy.id]))
    }
  })
})

describe('문의 · 비회원 채팅 연락처', () => {
  const inquiry = (phone: string, locale: 'ko' | 'ja') => {
    const fd = new FormData()
    for (const [k, v] of Object.entries({ type: '', body: `연락처문의-${RUN}`, name: '문의자', phone, email: `phone-inq+${RUN}@example.com`, locale, consent: 'on' })) fd.set(k, v)
    fd.append('country', 'jp')
    return fetch(`${BASE}/api/inquiry`, { method: 'POST', body: fd })
  }

  it.each([
    ['12345', 'ko'],
    ['060-1234-5678', 'ko'],
    ['+81 10-1234-5678', 'ja'],
  ] as const)('문의: %s (%s) 는 400 invalid_phone', async (phone, locale) => {
    const res = await inquiry(phone, locale)
    expect(res.status).toBe(400)
    expect(await res.json()).toEqual({ error: 'invalid_phone' })
  })

  it('문의: 일본어 화면의 090 번호는 +81 로 저장된다', async () => {
    const res = await inquiry('090-1234-5678', 'ja')
    expect(res.status).toBe(200)
    const { inquiryId } = await res.json()
    inquiryIds.push(inquiryId)
    const doc = await (await localPayload()).findByID({ collection: 'inquiries', id: inquiryId, overrideAccess: true })
    expect(doc.phone).toBe('+819012345678')
  })

  const guest = (phone: string, locale: 'ko' | 'ja', n: string) =>
    api('/api/chat/guest', {
      method: 'POST',
      headers: { 'x-real-ip': freshIp() },
      body: JSON.stringify({ name: '손님', email: `phone-guest-${n}+${RUN}@ayuta.test`, phone, consent: true, locale }),
    })

  it.each([
    ['012-1234-5678', 'ko'],
    ['010-1234', 'ko'],
    ['+81 10-1234-5678', 'ja'],
  ] as const)('비회원 채팅: %s (%s) 는 400', async (phone, locale) => {
    const res = await guest(phone, locale, 'bad')
    expect(res.status).toBe(400)
    expect((await res.json()).error).toBe('invalid_input')
  })

  it('비회원 채팅: 일본 번호는 E.164 로 방에 남는다', async () => {
    const res = await guest('+81 80-1234-5678', 'ko', 'jp')
    expect(res.status).toBe(200)
    const payload = await localPayload()
    const { docs } = await payload.find({ collection: 'chat-threads', where: { guestEmail: { equals: `phone-guest-jp+${RUN}@ayuta.test` } }, limit: 1, overrideAccess: true })
    expect(docs[0]?.guestPhone).toBe('+818012345678')
  })
})
