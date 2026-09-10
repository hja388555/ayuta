// loadPriceBook의 minor() 검증이 실제 DB 행 앞에서도 동작하는지 확인한다.
// price_entries.price_krw/price_jpy는 Postgres numeric이라 손상된 값(소수·음수)이
// 스키마 레벨에서는 걸러지지 않는다 — minor()가 유일한 방어선이다. 이 검증이
// 죽으면 손상된 단가 행이 그대로 견적 금액이 되어 나간다.
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { localPayload } from './helpers/localApi'
import { loadPriceBook } from '../src/lib/price-book'

const RUN = Date.now()

describe('loadPriceBook — 손상된 단가 방어', () => {
  const createdIds: number[] = []

  afterAll(async () => {
    const payload = await localPayload()
    for (const id of createdIds) {
      await payload.delete({ collection: 'price-entries', id, overrideAccess: true }).catch(() => {})
    }
  })

  it('소수 단가는 Payload API로는 못 넣는다 — raw SQL로 직접 손상시킨다', async () => {
    const payload = await localPayload()
    // 카테고리를 테스트마다 분리한다 — 같은 카테고리에 손상된 행이 여러 개
    // 쌓이면 loadPriceBook이 어느 행에서 먼저 멈추는지가 반복 순서에 좌우되고,
    // 각 테스트가 기대하는 에러 메시지(정수 vs 음수)를 못 고를 수 있다.
    const created = await payload.create({
      collection: 'price-entries',
      overrideAccess: true,
      data: { key: `broken-decimal-${RUN}`, labelKo: '손상됨', labelJa: '損傷', category: 1, priceKrw: 1000, priceJpy: 100, active: true },
    })
    createdIds.push(created.id as number)

    // Payload의 number 필드는 애플리케이션 레벨에서 정수를 강제하지 않는다 —
    // numeric 컬럼이라 DB도 막지 않는다. 손상은 운영에서 이렇게(수동 UPDATE, 마이그레이션
    // 버그 등) 들어온다고 가정하고 raw SQL로 재현한다.
    await payload.db.pool.query(`UPDATE price_entries SET price_krw = 1000.5 WHERE id = $1`, [created.id])

    await expect(loadPriceBook(1, 'KRW')).rejects.toThrow(/정수/)
  })

  it('음수 단가도 거부한다', async () => {
    const payload = await localPayload()
    const created = await payload.create({
      collection: 'price-entries',
      overrideAccess: true,
      data: { key: `broken-negative-${RUN}`, labelKo: '손상됨', labelJa: '損傷', category: 2, priceKrw: 1000, priceJpy: 100, active: true },
    })
    createdIds.push(created.id as number)

    await payload.db.pool.query(`UPDATE price_entries SET price_krw = -500 WHERE id = $1`, [created.id])

    await expect(loadPriceBook(2, 'KRW')).rejects.toThrow(/음수/)
  })
})
