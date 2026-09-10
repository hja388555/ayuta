// order-counter.ts 와 같은 사정: 'server-only' 는 설치돼 있지 않지만(의존성 추가 금지)
// Next.js 가 지정자를 자체 해석해 빌드 타임에 클라이언트 번들 유입을 막는다.
// vitest.config.ts 의 alias 가 테스트에서 이 import 를 빈 스텁으로 돌린다.
import 'server-only'
import { getPayload } from 'payload'
import config from '@payload-config'
import { ORDER_STATUSES, type OrderStatus } from '../collections/Orders'

const ALLOWED: Record<OrderStatus, readonly OrderStatus[]> = {
  pending: ['paid', 'failed', 'cancelled', 'fraud_suspected'],
  paid: ['in_progress', 'cancelled', 'fraud_suspected'],
  in_progress: ['done', 'cancelled'],
  done: [],
  failed: [],
  cancelled: [],
  fraud_suspected: [],
}

export function canTransition(from: OrderStatus, to: OrderStatus): boolean {
  const allowed = ALLOWED[from]
  if (!allowed) return false
  return allowed.includes(to)
}

/**
 * 상태를 바꾸고 기록을 남긴다.
 *
 * `WHERE status = $2` 조건부 갱신이라, 같은 전이가 동시에 두 번 들어와도 하나만 통과한다.
 * 읽고 나서 쓰면 결제 확정이 중복으로 기록된다.
 * 갱신이 실제로 일어난 경우에만 전이 기록을 남긴다 — 일어나지 않은 일을 기록하지 않는다.
 *
 * UPDATE 와 전이 기록 INSERT 는 풀에서 뽑은 같은 client 위에서 하나의 트랜잭션으로
 * 묶는다 — 둘을 따로 커밋하면 두 번째가 실패하거나 그 사이에 프로세스가 죽었을 때
 * 주문은 이미 옮겨갔는데 기록이 없는 상태가 생긴다. append-only 전이표는 감사
 * 근거의 유일한 원본이라 그 공백은 재시도로도 못 고친다(다음 호출자는 이미 바뀐
 * status를 보고 정당하게 거부한다). Payload의 order-transitions 컬렉션 hook을 타지
 * 않고 같은 커넥션에 직접 INSERT 하는 이유이기도 하다 — hook이 별도 커넥션을 쓰면
 * 트랜잭션이 나뉜다.
 * UPDATE가 raw SQL인 이유는 Payload 훅(hooks)을 우회해 원자성을 지키기 위해서다 —
 * 그래서 updated_at도 훅이 아니라 이 문장이 직접 관리한다.
 */
export async function transitionOrder(
  orderId: number,
  to: OrderStatus,
  actorId: number | null,
  reason?: string,
): Promise<boolean> {
  const payload = await getPayload({ config })
  const client = await payload.db.pool.connect()
  try {
    await client.query('BEGIN')

    const found = await payload.findByID({ collection: 'orders', id: orderId, overrideAccess: true })
    const from = found.status as OrderStatus
    if (!canTransition(from, to)) {
      await client.query('ROLLBACK')
      return false
    }

    const res = await client.query(
      `UPDATE orders SET status = $1, updated_at = NOW() WHERE id = $2 AND status = $3 RETURNING id`,
      [to, orderId, from],
    )
    if ((res.rowCount ?? 0) === 0) {
      await client.query('ROLLBACK')
      return false
    }

    await client.query(
      `INSERT INTO order_transitions (order_id, from_status, to_status, actor_id, reason, at, updated_at, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, NOW(), NOW())`,
      [orderId, from, to, actorId, reason ?? null, new Date().toISOString()],
    )

    await client.query('COMMIT')
    return true
  } catch (err) {
    await client.query('ROLLBACK')
    throw err
  } finally {
    client.release()
  }
}
