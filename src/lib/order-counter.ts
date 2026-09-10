// 'server-only' 패키지는 설치돼 있지 않지만(의존성 추가 금지) Next.js 가 지정자를
// 자체 해석하므로 그냥 import 해도 빌드는 깨지지 않는다 — 없이는 'use client' 컴포넌트가
// nextOrderNumber 를 끌어당겨 payload.config·pg 를 클라이언트 번들 그래프로 끌고 가는
// 사고가 조용한 번들링 오류로만 드러난다. vitest.config.ts 의 alias 가 이 지정자를
// 빈 스텁으로 돌려서, 가드를 켠 채로도 테스트는 그대로 통과한다.
import 'server-only'
import { getPayload } from 'payload'
import config from '@payload-config'
import { dayKey, formatOrderNumber, type OrderScope } from './order-number'

/**
 * 일자별 순번을 하나 받아 주문번호로 만든다.
 *
 * 증가와 반환을 한 문장에서 끝낸다. 읽고 나서 더해 쓰면 동시 요청이 같은 번호를 받는다.
 * PostgreSQL 은 같은 행에 대한 UPDATE 를 직렬화하므로 이 문장은 동시성 아래에서도 안전하다.
 * `order_counters` 테이블은 Payload 컬렉션이 아니라 순수 SQL 테이블이다 —
 * `payload.db.pool` 로 원시 SQL을 쓴다 (src/lib/dal.ts 의 admin_otps 원자적 갱신과 같은 패턴).
 */
export async function nextOrderNumber(scope: OrderScope, at: Date = new Date()): Promise<string> {
  const day = dayKey(at)
  const payload = await getPayload({ config })
  const result = await payload.db.pool.query(
    `INSERT INTO order_counters (scope, day, seq)
     VALUES ($1, $2, 1)
     ON CONFLICT (scope, day)
     DO UPDATE SET seq = order_counters.seq + 1
     RETURNING seq`,
    [scope, day],
  )
  const seq = result.rows[0]?.seq
  if (typeof seq !== 'number') throw new Error('순번 채번에 실패했습니다.')
  return formatOrderNumber(scope, at, seq)
}
