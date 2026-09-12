// 2번(현지 영상 제작) 영상 종류·길이 쌍 주문 통합 테스트. 실제 DB 단가·계약서 템플릿을 읽고
// 실제 orders 행을 만든다. `pnpm seed:prices && pnpm seed:contracts` 가 먼저 돼 있어야 한다.
import { afterAll, describe, expect, it } from 'vitest'
import { localPayload } from './helpers/localApi'
import { createOrder } from '../src/lib/checkout/create-order'
import { loadPriceBook } from '../src/lib/price-book'
import { selectionFromQuery } from '../src/lib/checkout/selection-from-query'
import { CATEGORIES } from '../src/lib/categories'

const RUN = Date.now()

const orderer = {
  name: `영상고객${RUN}`,
  phone: '010-1234-5678',
  email: `video-${RUN}@example.com`,
  postalCode: '12345',
  address1: '서울특별시 동대문구 답십리동 323',
}

const videoInput = (selection: unknown) => ({
  categorySlug: 'local-video',
  locale: 'ko' as const,
  selection,
  consents: { agree: true },
  orderer: { ...orderer },
  signature: orderer.name,
})

const model = CATEGORIES.find((c) => c.no === 2)!.model

describe('2번 영상 종류·길이 쌍 주문', () => {
  const createdOrderIds: number[] = []

  afterAll(async () => {
    const payload = await localPayload()
    for (const id of createdOrderIds) {
      await payload.delete({ collection: 'orders', id, overrideAccess: true }).catch(() => {})
    }
  })

  it('영상 두 편(같은 길이)을 고르면 DB 단가로 쌍마다 더해 저장한다 — 같은 길이도 두 번 센다', async () => {
    // 결제 화면이 받는 쿼리 모양 그대로 selection 을 만든다
    const selection = selectionFromQuery(model, {
      item: 'country-kr',
      pair: ['video-type-company:video-length-10m', 'video-type-product:video-length-10m'],
      country: 'kr',
    })
    const result = await createOrder(videoInput(selection))
    expect(result.ok).toBe(true)
    if (!result.ok) return
    createdOrderIds.push(result.orderId)

    const book = await loadPriceBook(2, 'KRW')
    const price = (key: string) => {
      const e = book.entries[key]
      if (!e) throw new Error(`${key} 단가가 없습니다 — pnpm seed:prices 를 먼저 실행하세요`)
      return e.amount
    }
    const expected = price('video-type-company') + price('video-type-product') + 2 * price('video-length-10m')
    expect(result.amount).toBe(expected)

    const payload = await localPayload()
    const order = await payload.findByID({ collection: 'orders', id: result.orderId, overrideAccess: true })
    expect(order.amount).toBe(expected)
    const items = (order.items ?? []) as { code: string; unitAmount: number; quantity: number }[]
    expect(items.map((i) => i.code)).toEqual(['video-type-company:video-length-10m', 'video-type-product:video-length-10m'])
    expect(items.reduce((acc, i) => acc + i.unitAmount * i.quantity, 0)).toBe(expected)
    const contractItems = (order.contractItems ?? []) as { label: string; value: string }[]
    expect(contractItems.map((i) => i.label)).toEqual(['촬영 국가', '영상 1', '영상 2'])
    expect(order.contractText as string).not.toContain('{{')
  })

  it('클라이언트가 보낸 금액은 무시한다', async () => {
    const result = await createOrder({
      ...videoInput({ pairs: [{ type: 'video-type-event', length: 'video-length-60m' }], country: ['jp'] }),
      amount: 1,
    })
    expect(result.ok).toBe(true)
    if (!result.ok) return
    createdOrderIds.push(result.orderId)
    const book = await loadPriceBook(2, 'KRW')
    expect(result.amount).toBe(book.entries['video-type-event']!.amount + book.entries['video-length-60m']!.amount)
  })

  it.each([
    ['쌍이 없다', { pairs: [], country: ['kr'] }],
    ['길이가 빠졌다', { pairs: [{ type: 'video-type-company', length: '' }], country: ['kr'] }],
    ['같은 종류를 두 번 보냈다', { pairs: [{ type: 'video-type-company', length: 'video-length-10m' }, { type: 'video-type-company', length: 'video-length-60m' }], country: ['kr'] }],
    ['종류·길이를 뒤바꿨다', { pairs: [{ type: 'video-length-10m', length: 'video-type-company' }], country: ['kr'] }],
    ['없는 키다', { pairs: [{ type: 'video-type-free', length: 'video-length-10m' }], country: ['kr'] }],
    ['쌍 없이 옛 items 모양만 보냈다', { items: ['video-type-company', 'video-length-10m'], country: ['kr'] }],
  ])('%s — 주문을 만들지 않는다', async (_name, selection) => {
    const result = await createOrder(videoInput(selection))
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.reason).toBe('pricing_failed')
  })

  it('옛 결제 주소(item=종류&item=길이)도 쌍 하나로 받아 같은 금액을 청구한다', async () => {
    const selection = selectionFromQuery(model, { item: ['country-kr', 'video-type-store', 'video-length-30m'], country: 'kr' })
    const result = await createOrder(videoInput(selection))
    expect(result.ok).toBe(true)
    if (!result.ok) return
    createdOrderIds.push(result.orderId)
    const book = await loadPriceBook(2, 'KRW')
    expect(result.amount).toBe(book.entries['video-type-store']!.amount + book.entries['video-length-30m']!.amount)
  })

  it('4번(지하철·버스)은 그대로 항목 합계 × 기간 배수로 주문된다', async () => {
    const result = await createOrder({
      categorySlug: 'transit',
      locale: 'ko' as const,
      selection: { items: ['subway-city-seoul', 'subway-spot-door-side'], period: '1w', size: '', country: ['kr'] },
      consents: { terms: true, privacy: true, contract: true },
      orderer: { ...orderer },
      signature: orderer.name,
    })
    expect(result.ok).toBe(true)
    if (!result.ok) return
    createdOrderIds.push(result.orderId)
    const payload = await localPayload()
    const settings = await payload.findGlobal({ slug: 'pricing-settings', overrideAccess: true, depth: 0 })
    const factor = (settings.periodMultipliers as Record<string, number>)['1w']!
    const book = await loadPriceBook(4, 'KRW')
    const base = book.entries['subway-city-seoul']!.amount + book.entries['subway-spot-door-side']!.amount
    expect(result.amount).toBe(Math.floor((base * Math.round(factor * 100)) / 100))
  })
})
