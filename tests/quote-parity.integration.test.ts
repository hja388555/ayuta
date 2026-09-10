// 미리보기(화면)와 서버(청구)가 같은 calculate()를 부르더라도, 폼이 늘어날수록 "어떤 항목을
// 계산기에 넘기는지"가 갈라질 위험이 커진다 — 예: 화면이 priced:false 항목을 실수로 같이
// 보내면 화면과 서버 결과가 어긋난다. 사람 눈이 아니라 이 테스트가 그 어긋남을 잡는다.
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { calculate } from '@ayuta/pricing'
import { localPayload } from './helpers/localApi'
import { loadPriceBook } from '../src/lib/price-book'
import { previewTotal } from '../src/components/TierForm'
import { previewGroupTotal } from '../src/components/GroupForm'
import { CATEGORIES } from '../src/lib/categories'

const RUN = Date.now()
const k = (name: string) => `parity-${RUN}-${name}`

describe('견적 정합성 — 미리보기와 서버가 카테고리 1~4에서 같은 숫자를 낸다', () => {
  const createdIds: number[] = []

  beforeAll(async () => {
    const payload = await localPayload()
    const rows = [
      // 1번 — tier
      { key: k('tier-basic'), category: 1, priceKrw: 500_000, priceJpy: 50_000 },
      { key: k('tier-standard'), category: 1, priceKrw: 900_000, priceJpy: 90_000 },
      // 2번 — sum
      { key: k('video-a'), category: 2, priceKrw: 300_000, priceJpy: 30_000 },
      { key: k('video-b'), category: 2, priceKrw: 400_000, priceJpy: 40_000 },
      // 3번 — sum
      { key: k('press-a'), category: 3, priceKrw: 200_000, priceJpy: 20_000 },
      { key: k('press-b'), category: 3, priceKrw: 250_000, priceJpy: 25_000 },
      // 4번 — sumMultiplier
      { key: k('transit-a'), category: 4, priceKrw: 100_000, priceJpy: 10_000 },
      { key: k('transit-b'), category: 4, priceKrw: 150_000, priceJpy: 15_000 },
    ]
    for (const data of rows) {
      const created = await payload.create({
        collection: 'price-entries',
        overrideAccess: true,
        data: { ...data, labelKo: data.key, labelJa: data.key, active: true },
      })
      createdIds.push(created.id as number)
    }
  })

  afterAll(async () => {
    const payload = await localPayload()
    for (const id of createdIds) {
      await payload.delete({ collection: 'price-entries', id, overrideAccess: true }).catch(() => {})
    }
  })

  it('1번(tier): 등급 두 개를 고르면 미리보기와 서버가 같다', async () => {
    const def = CATEGORIES.find((c) => c.no === 1)!
    const book = await loadPriceBook(1, 'KRW')
    const tiers = [k('tier-basic'), k('tier-standard')]

    const preview = previewTotal(book, def.model, tiers, [])
    const server = calculate(def.model, book, { tiers, platforms: [] })

    expect(server.ok).toBe(true)
    expect(server.ok && server.total).toBe(preview)
    expect(preview).toBe(1_400_000)
  })

  it('2번(sum): 항목 두 개를 고르면 미리보기와 서버가 같다', async () => {
    const def = CATEGORIES.find((c) => c.no === 2)!
    const book = await loadPriceBook(2, 'KRW')
    const items = [k('video-a'), k('video-b')]

    const preview = previewGroupTotal(book, def.model, items)
    const server = calculate(def.model, book, { items })

    expect(server.ok).toBe(true)
    expect(server.ok && server.total).toBe(preview)
    expect(preview).toBe(700_000)
  })

  it('3번(sum): 항목 두 개를 고르면 미리보기와 서버가 같다', async () => {
    const def = CATEGORIES.find((c) => c.no === 3)!
    const book = await loadPriceBook(3, 'KRW')
    const items = [k('press-a'), k('press-b')]

    const preview = previewGroupTotal(book, def.model, items)
    const server = calculate(def.model, book, { items })

    expect(server.ok).toBe(true)
    expect(server.ok && server.total).toBe(preview)
    expect(preview).toBe(450_000)
  })

  it('4번(sumMultiplier): 항목 두 개 + 기간을 고르면 미리보기와 서버가 같다', async () => {
    const def = CATEGORIES.find((c) => c.no === 4)!
    const book = await loadPriceBook(4, 'KRW')
    const items = [k('transit-a'), k('transit-b')]
    const period = '2w'

    const preview = previewGroupTotal(book, def.model, items, period)
    const server = calculate(def.model, book, { items, period })

    expect(server.ok).toBe(true)
    expect(server.ok && server.total).toBe(preview)
    // multipliers['2w'] = 1.8 (src/lib/categories.ts) — 250,000 * 1.8 = 450,000
    expect(preview).toBe(450_000)
  })

  it('단가에 없는 키가 섞이면 미리보기·서버 양쪽 모두 실패한다 — 한쪽만 실패하면 화면과 청구가 갈라진다', async () => {
    const def = CATEGORIES.find((c) => c.no === 3)!
    const book = await loadPriceBook(3, 'KRW')
    const items = [k('press-a'), 'ghost-key-없음']

    const preview = previewGroupTotal(book, def.model, items)
    const server = calculate(def.model, book, { items })

    expect(preview).toBe(0)
    expect(server.ok).toBe(false)
  })
})
