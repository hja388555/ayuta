import { beforeAll, describe, expect, it } from 'vitest'
import { localPayload } from './helpers/localApi'
import { ensureOrderCounters } from '../scripts/ensure-order-counters'
import { nextOrderNumber } from '../src/lib/order-counter'
import { parseOrderNumber } from '../src/lib/order-number'

describe('순번 채번', () => {
  beforeAll(async () => {
    const payload = await localPayload()
    // order_counters는 Payload 컬렉션이 아니라서 auto-push가 만들어 주지 않는다.
    // CI의 fresh DB에서도 이 테스트가 스스로 준비되도록 여기서도 부트스트랩을 호출한다.
    await ensureOrderCounters(payload.db.pool)
    await payload.db.pool.query(`DELETE FROM order_counters`)
  })

  it('1부터 순서대로 준다', async () => {
    const at = new Date('2026-09-18T01:00:00+09:00')
    expect(await nextOrderNumber('AY', at)).toBe('AY-20260918-0001')
    expect(await nextOrderNumber('AY', at)).toBe('AY-20260918-0002')
  })

  it('동시에 50건이 들어와도 번호가 겹치지 않는다', async () => {
    const at = new Date('2026-09-19T01:00:00+09:00')
    const results = await Promise.all(Array.from({ length: 50 }, () => nextOrderNumber('AY', at)))
    expect(new Set(results).size).toBe(50)
    // slice(-4)는 순번이 10000 이상으로 넘어가면 자릿수가 달라져 잘못 잘린다.
    // 포맷의 실제 파서를 써서 그 가정을 없앤다.
    const seqs = results.map((r) => parseOrderNumber(r)!.seq).sort((a, b) => a - b)
    expect(seqs).toEqual(Array.from({ length: 50 }, (_, i) => i + 1))
  })

  it('범위가 다르면 순번이 따로 간다', async () => {
    const at = new Date('2026-09-20T01:00:00+09:00')
    expect(await nextOrderNumber('AY', at)).toBe('AY-20260920-0001')
    expect(await nextOrderNumber('QT', at)).toBe('QT-20260920-0001')
  })

  it('날이 바뀌면 1로 돌아간다', async () => {
    expect(await nextOrderNumber('AY', new Date('2026-09-21T01:00:00+09:00'))).toBe('AY-20260921-0001')
    expect(await nextOrderNumber('AY', new Date('2026-09-22T01:00:00+09:00'))).toBe('AY-20260922-0001')
  })
})
