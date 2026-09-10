// createOrder 통합 테스트. 실제 DB(단가·계약서 템플릿)를 읽고 실제 orders 행을 만든다.
// `pnpm seed:prices && pnpm seed:contracts`를 먼저 돌려야 한다 — 1번(digital-sns)
// 단가와 1번 계약서 템플릿이 있어야 이 테스트들이 통과한다.
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { localPayload } from './helpers/localApi'
import { createOrder } from '../src/lib/checkout/create-order'

const RUN = Date.now()

const validOrderer = {
  name: `테스트고객${RUN}`,
  phone: '010-1234-5678',
  email: `test-${RUN}@example.com`,
  postalCode: '12345',
  address1: '서울특별시 동대문구 답십리동 323',
}

// 1번(digital-sns) — standard 등급 1개. scripts/seed-prices.ts 가 심는 실제 키다
const baseInput = () => ({
  categorySlug: 'digital-sns',
  locale: 'ko' as const,
  selection: { tiers: ['standard'], platforms: [], country: ['kr'] },
  consents: { agree: true },
  orderer: { ...validOrderer },
  signature: validOrderer.name,
})

describe('createOrder', () => {
  const createdOrderIds: number[] = []

  afterAll(async () => {
    const payload = await localPayload()
    for (const id of createdOrderIds) {
      await payload.delete({ collection: 'orders', id, overrideAccess: true }).catch(() => {})
    }
  })

  it('클라이언트가 보낸 금액을 쓰지 않는다 — 스키마에 금액 필드가 아예 없다', async () => {
    const withAmount = { ...baseInput(), amount: 1, total: 1, price: 1 }
    const result = await createOrder(withAmount)
    expect(result.ok).toBe(true)
    if (result.ok) {
      createdOrderIds.push(result.orderId)
      // standard 등급 DB 단가(2,000,000원)로 계산된 값이지 클라이언트가 보낸 1이 아니다
      expect(result.amount).toBe(2_000_000)
    }
  })

  it('선택 항목으로 서버가 계산한 금액이 저장된다', async () => {
    const result = await createOrder(baseInput())
    expect(result.ok).toBe(true)
    if (!result.ok) return
    createdOrderIds.push(result.orderId)

    const payload = await localPayload()
    const order = await payload.findByID({ collection: 'orders', id: result.orderId, overrideAccess: true })
    expect(order.amount).toBe(2_000_000)
    expect(order.currency).toBe('KRW')
  })

  it('필수 동의가 빠지면 주문이 만들어지지 않는다', async () => {
    const result = await createOrder({ ...baseInput(), consents: {} })
    expect(result).toEqual({ ok: false, reason: 'consent_required' })
  })

  it('정의에 없는 동의 키를 보내도 통과하지 않는다', async () => {
    // 'agree'가 아니라 클라이언트가 지어낸 키를 체크했다 — 실제 필수 키가 안 채워졌으므로 거부
    const result = await createOrder({ ...baseInput(), consents: { madeUpKey: true } })
    expect(result).toEqual({ ok: false, reason: 'consent_required' })
  })

  it('계약서 빈칸을 못 채우면(=템플릿이 없으면) 주문을 만들지 않는다', async () => {
    // 예전에는 "3번은 템플릿이 없다"는 시드 상태에 기댔다 — 3번 원문이 들어오면서 그 전제가
    // 깨졌다. 시드에 기대지 않도록 3번 한국어 템플릿을 잠시 내려(active:false) 부재를 만든다.
    // createOrder 는 active 템플릿만 찾는다(create-order.ts). 5번은 계산 단계에서 먼저 막혀
    // no_contract 까지 오지 않으므로 대신 쓸 수 없다
    const payload = await localPayload()
    const { docs } = await payload.find({
      collection: 'contract-templates',
      where: { and: [{ category: { equals: 3 } }, { locale: { equals: 'ko' } }, { active: { equals: true } }] },
      overrideAccess: true,
    })
    try {
      for (const d of docs) {
        await payload.update({ collection: 'contract-templates', id: d.id, data: { active: false }, overrideAccess: true })
      }
      const result = await createOrder({
        categorySlug: 'press-blog',
        locale: 'ko' as const,
        selection: { items: ['blog-note'], country: ['kr'] },
        consents: {},
        orderer: { ...validOrderer },
        signature: validOrderer.name,
      })
      expect(result).toEqual({ ok: false, reason: 'no_contract' })
    } finally {
      for (const d of docs) {
        await payload.update({ collection: 'contract-templates', id: d.id, data: { active: true }, overrideAccess: true })
      }
    }
  })

  it('3번(대표신문·지역신문·블로그)은 계약서를 채워 주문을 만든다', async () => {
    const result = await createOrder({
      categorySlug: 'press-blog',
      locale: 'ko' as const,
      selection: { items: ['national-kr-hankyung', 'blog-note'], country: ['kr', 'jp'] },
      consents: { terms: true, privacy: true, contract: true },
      orderer: { ...validOrderer },
      signature: validOrderer.name,
    })
    expect(result.ok).toBe(true)
    if (!result.ok) return
    createdOrderIds.push(result.orderId)

    const payload = await localPayload()
    const order = await payload.findByID({ collection: 'orders', id: result.orderId, overrideAccess: true })
    const text = order.contractText as string
    expect(text).toContain('AYUTA 대표신문·지역신문·블로그 광고 서비스 계약서')
    expect(text).toContain('광고 국가: 한국, 일본')
    expect(text).toContain('02-3394-8838')
    expect(text).toContain(`전자서명: ${validOrderer.name}`)
    // 채우지 못한 자리표시자가 남으면 contract_incomplete 로 막혔어야 한다 — 이중 확인
    expect(text).not.toContain('{{')
  })

  it('3번은 계약서 동의 3종이 모두 있어야 한다', async () => {
    const result = await createOrder({
      categorySlug: 'press-blog',
      locale: 'ko' as const,
      selection: { items: ['blog-note'], country: ['kr'] },
      consents: { terms: true, privacy: true },
      orderer: { ...validOrderer },
      signature: validOrderer.name,
    })
    expect(result).toEqual({ ok: false, reason: 'consent_required' })
  })

  it('비회원도 주문할 수 있고 주문자 정보가 저장된다', async () => {
    const result = await createOrder(baseInput(), null)
    expect(result.ok).toBe(true)
    if (!result.ok) return
    createdOrderIds.push(result.orderId)

    const payload = await localPayload()
    const order = await payload.findByID({ collection: 'orders', id: result.orderId, overrideAccess: true })
    expect(order.customer).toBeFalsy()
    expect(order.orderer?.name).toBe(validOrderer.name)
    expect(order.orderer?.email).toBe(validOrderer.email)
  })

  it('주문자 정보가 비면 거부한다', async () => {
    const { orderer: _omit, ...rest } = baseInput()
    const result = await createOrder({ ...rest, orderer: { ...validOrderer, name: '' } })
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.reason).toBe('invalid_input')
  })

  it('전자서명 이름이 주문자 이름과 다르면 거부한다', async () => {
    const result = await createOrder({ ...baseInput(), signature: '다른사람' })
    expect(result).toEqual({ ok: false, reason: 'signature_mismatch' })
  })

  it('계약서 전문이 주문에 값으로 저장된다', async () => {
    const result = await createOrder(baseInput())
    expect(result.ok).toBe(true)
    if (!result.ok) return
    createdOrderIds.push(result.orderId)

    const payload = await localPayload()
    const order = await payload.findByID({ collection: 'orders', id: result.orderId, overrideAccess: true })
    expect(typeof order.contractText).toBe('string')
    expect((order.contractText as string).length).toBeGreaterThan(0)
    expect(order.contractText as string).toContain(validOrderer.name)
  })

  it('저장 후 단가를 바꿔도 그 주문의 금액과 계약서가 변하지 않는다', async () => {
    const result = await createOrder(baseInput())
    expect(result.ok).toBe(true)
    if (!result.ok) return
    createdOrderIds.push(result.orderId)

    const payload = await localPayload()
    const before = await payload.findByID({ collection: 'orders', id: result.orderId, overrideAccess: true })

    // standard 단가를 임시로 바꾼다
    const { docs } = await payload.find({
      collection: 'price-entries',
      where: { and: [{ category: { equals: 1 } }, { key: { equals: 'standard' } }] },
      overrideAccess: true,
    })
    const priceEntry = docs[0]
    if (!priceEntry) throw new Error('standard 단가 항목을 찾지 못했습니다 — pnpm seed:prices 를 먼저 실행하세요')
    const originalPriceKrw = priceEntry.priceKrw as number
    try {
      await payload.update({
        collection: 'price-entries',
        id: priceEntry.id,
        overrideAccess: true,
        data: { priceKrw: originalPriceKrw + 999_999 },
      })

      const after = await payload.findByID({ collection: 'orders', id: result.orderId, overrideAccess: true })
      expect(after.amount).toBe(before.amount)
      expect(after.contractText).toBe(before.contractText)
    } finally {
      await payload.update({
        collection: 'price-entries',
        id: priceEntry.id,
        overrideAccess: true,
        data: { priceKrw: originalPriceKrw },
      })
    }
  })

  it('같은 요청을 두 번 보내면 주문번호가 다르다', async () => {
    const r1 = await createOrder(baseInput())
    const r2 = await createOrder(baseInput())
    expect(r1.ok).toBe(true)
    expect(r2.ok).toBe(true)
    if (!r1.ok || !r2.ok) return
    createdOrderIds.push(r1.orderId, r2.orderId)
    expect(r1.orderNumber).not.toBe(r2.orderNumber)
  })

  it('같은 멱등키로 두 번 보내면 주문이 하나만 만들어진다 (Ruling 15)', async () => {
    const key = `idem-${RUN}-${Math.random().toString(36).slice(2, 8)}`
    const r1 = await createOrder({ ...baseInput(), idempotencyKey: key })
    expect(r1.ok).toBe(true)
    if (!r1.ok) return
    createdOrderIds.push(r1.orderId)

    const r2 = await createOrder({ ...baseInput(), idempotencyKey: key })
    expect(r2.ok).toBe(true)
    if (!r2.ok) return
    // 두 번째 호출이 새 행을 만들었다면 createdOrderIds에도 추가해 정리해야 하지만,
    // 멱등이 지켜진다면 orderId가 같아서 추가할 필요가 없다 — 그게 이 테스트의 요점이다
    expect(r2.orderId).toBe(r1.orderId)
    expect(r2.orderNumber).toBe(r1.orderNumber)
  })

  it('같은 멱등키로 동시에 두 번 보내도 주문이 하나만 만들어진다 (동시 경합)', async () => {
    // 순차 재시도(위 테스트)는 두 번째 호출 시점에 이미 0번 조회가 첫 번째 주문을 찾아내
    // 통과한다. 여기서는 둘 다 조회를 통과한 "뒤"에 생성이 겹치는 진짜 경합을 재현한다 —
    // Promise.all로 같은 멱등키를 쓰는 두 createOrder를 동시에 쏘면 하나는 유니크
    // 인덱스에서 막혀야 하고, 그 경로가 크래시 없이 승자의 주문을 그대로 돌려줘야 한다
    const key = `idem-race-${RUN}-${Math.random().toString(36).slice(2, 8)}`
    const [r1, r2] = await Promise.all([
      createOrder({ ...baseInput(), idempotencyKey: key }),
      createOrder({ ...baseInput(), idempotencyKey: key }),
    ])

    expect(r1.ok).toBe(true)
    expect(r2.ok).toBe(true)
    if (!r1.ok || !r2.ok) return
    createdOrderIds.push(r1.orderId)
    if (r2.orderId !== r1.orderId) createdOrderIds.push(r2.orderId)

    expect(r2.orderId).toBe(r1.orderId)
    expect(r2.orderNumber).toBe(r1.orderNumber)

    const payload = await localPayload()
    const { docs } = await payload.find({
      collection: 'orders',
      where: { idempotencyKey: { equals: key } },
      limit: 10,
      overrideAccess: true,
    })
    expect(docs).toHaveLength(1)
  })

  it('템플릿이 있어도 채우지 못한 빈칸이 있으면 주문을 만들지 않는다 (I4)', async () => {
    const payload = await localPayload()
    const { docs } = await payload.find({
      collection: 'contract-templates',
      where: { and: [{ category: { equals: 1 } }, { locale: { equals: 'ko' } }] },
      limit: 1,
      overrideAccess: true,
    })
    const template = docs[0]
    if (!template) throw new Error('1번 계약서 템플릿을 찾지 못했습니다 — pnpm seed:contracts 를 먼저 실행하세요')
    const originalBody = template.body as string
    try {
      await payload.update({
        collection: 'contract-templates',
        id: template.id,
        overrideAccess: true,
        // fillContract가 알지 못하는 자리표시자를 하나 심는다 — 템플릿은 존재하지만
        // 빈칸을 다 못 채우는 상황을 재현한다(지금까지는 템플릿 부재만 테스트했다)
        data: { body: `${originalBody}\n{{unknownPlaceholder}}` },
      })

      const result = await createOrder(baseInput())
      expect(result).toEqual({ ok: false, reason: 'contract_incomplete', detail: ['unknownPlaceholder'] })
    } finally {
      await payload.update({
        collection: 'contract-templates',
        id: template.id,
        overrideAccess: true,
        data: { body: originalBody },
      })
    }
  })

  it('주문 생성 후 계약서 템플릿을 고쳐도 이미 만든 주문의 스냅샷은 바뀌지 않는다 (I4)', async () => {
    const result = await createOrder(baseInput())
    expect(result.ok).toBe(true)
    if (!result.ok) return
    createdOrderIds.push(result.orderId)

    const payload = await localPayload()
    const before = await payload.findByID({ collection: 'orders', id: result.orderId, overrideAccess: true })

    const { docs } = await payload.find({
      collection: 'contract-templates',
      where: { and: [{ category: { equals: 1 } }, { locale: { equals: 'ko' } }] },
      limit: 1,
      overrideAccess: true,
    })
    const template = docs[0]
    if (!template) throw new Error('1번 계약서 템플릿을 찾지 못했습니다')
    const originalBody = template.body as string
    try {
      await payload.update({
        collection: 'contract-templates',
        id: template.id,
        overrideAccess: true,
        data: { body: `${originalBody}\n[나중에 추가된 문구 — 과거 주문에는 없어야 한다]` },
      })

      const after = await payload.findByID({ collection: 'orders', id: result.orderId, overrideAccess: true })
      expect(after.contractText).toBe(before.contractText)
      expect(after.contractText as string).not.toContain('나중에 추가된 문구')
    } finally {
      await payload.update({
        collection: 'contract-templates',
        id: template.id,
        overrideAccess: true,
        data: { body: originalBody },
      })
    }
  })

  it('계약서 항목이 국가·채널 등 가격 없는 선택까지 사람이 읽을 이름으로 담긴다 (C1)', async () => {
    const result = await createOrder({ ...baseInput(), selection: { tiers: ['standard'], platforms: ['instagram', 'youtube'], country: ['kr'] } })
    expect(result.ok).toBe(true)
    if (!result.ok) return
    createdOrderIds.push(result.orderId)

    const payload = await localPayload()
    const order = await payload.findByID({ collection: 'orders', id: result.orderId, overrideAccess: true })
    const text = order.contractText as string
    // 바로 금액(숫자)이 아니라 사람이 읽을 라벨이어야 한다
    expect(text).toContain('인스타그램')
    expect(text).toContain('유튜브')
    expect(order.contractItems).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ label: '등급', value: expect.stringContaining('스탠다드') }),
        expect.objectContaining({ label: '플랫폼', value: expect.stringContaining('인스타그램') }),
      ]),
    )
  })

  it('나라를 고르지 않으면 주문이 만들어지지 않는다', async () => {
    const result = await createOrder({ ...baseInput(), selection: { tiers: ['standard'], platforms: [] } })
    expect(result).toEqual({ ok: false, reason: 'country_required' })
  })

  it('나라를 하나 고르면 주문이 만들어진다', async () => {
    const result = await createOrder({ ...baseInput(), selection: { tiers: ['standard'], platforms: [], country: ['kr'] } })
    expect(result.ok).toBe(true)
    if (!result.ok) return
    createdOrderIds.push(result.orderId)

    const payload = await localPayload()
    const order = await payload.findByID({ collection: 'orders', id: result.orderId, overrideAccess: true })
    expect(order.country).toEqual(['kr'])
    expect(order.contractText as string).toContain('한국')
  })

  it('나라를 둘 다 고르면 계약서에 "한국, 일본"이 찍힌다', async () => {
    const result = await createOrder({ ...baseInput(), selection: { tiers: ['standard'], platforms: [], country: ['kr', 'jp'] } })
    expect(result.ok).toBe(true)
    if (!result.ok) return
    createdOrderIds.push(result.orderId)

    const payload = await localPayload()
    const order = await payload.findByID({ collection: 'orders', id: result.orderId, overrideAccess: true })
    expect(order.country).toEqual(['kr', 'jp'])
    expect(order.contractText as string).toContain('광고 국가: 한국, 일본')
  })
})
