// order-state.ts 와 같은 사정 — 'server-only' 는 설치돼 있지 않지만 Next.js 가 지정자를
// 자체 해석해 클라이언트 번들 유입을 막는다. vitest 는 빈 스텁으로 alias 한다.
import 'server-only'
import { getPayload } from 'payload'
import config from '@payload-config'

export const SCHEDULE_FIELDS = ['contractStart', 'contractEnd', 'adStartDate'] as const
export type ScheduleField = (typeof SCHEDULE_FIELDS)[number]

/** Payload 필드명 → 실제 컬럼명. raw SQL 로 쓰기 때문에 한 곳에서만 매핑한다 */
const COLUMN: Record<ScheduleField, string> = {
  contractStart: 'contract_start',
  contractEnd: 'contract_end',
  adStartDate: 'ad_start_date',
}

export type SchedulePatch = Partial<Record<ScheduleField, string | Date | null>>
/** 'YYYY-MM-DD' 또는 null(미정) */
export type ScheduleDay = string | null
export type ScheduleDays = Record<ScheduleField, ScheduleDay>

export type SetScheduleResult =
  | { ok: true; changed: ScheduleField[] }
  | { ok: false; reason: 'not_found' | 'invalid_date' | 'reversed_period'; detail?: string }

const DAY_RE = /^\d{4}-\d{2}-\d{2}$/

// 저장소에 날짜 절단 유틸이 따로 없다(계약일 표기는 create-order.ts 가 Intl 로 직접
// 만든다). 여기서 쓰는 기준은 그쪽과 같은 Asia/Seoul 이다 — 한국 관리자가 화면에서 고른
// "9월 10일"이 UTC 기준으로 전날/다음날로 밀리면 계약기간이 하루 어긋난다.
const SEOUL_DAY = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'Asia/Seoul',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
})

/**
 * 어떤 입력이든 Asia/Seoul 기준 '그날'(YYYY-MM-DD)로 자른다.
 * 'YYYY-MM-DD' 문자열은 이미 날짜라서 타임존 변환 없이 그대로 쓴다 — Date 로 한 번
 * 돌리면 UTC 자정으로 해석돼 Seoul 기준 같은 날의 09:00 이 되고, 거기서 다시 자르면
 * 우연히 맞지만 그 우연에 기대지 않는다.
 * 파싱이 안 되면 null 이 아니라 undefined 를 돌려준다 — "미정"과 "쓰레기 입력"은 다르다.
 */
export function toSeoulDay(value: string | Date | null | undefined): ScheduleDay | undefined {
  if (value === null || value === undefined || value === '') return null
  if (typeof value === 'string' && DAY_RE.test(value)) {
    // 2026-02-31 같은 "형식은 맞고 존재하지 않는 날"을 걸러낸다
    const [y, m, d] = value.split('-').map(Number) as [number, number, number]
    const probe = new Date(Date.UTC(y, m - 1, d))
    if (probe.getUTCFullYear() !== y || probe.getUTCMonth() !== m - 1 || probe.getUTCDate() !== d) return undefined
    return value
  }
  const date = value instanceof Date ? value : new Date(value)
  if (Number.isNaN(date.getTime())) return undefined
  return SEOUL_DAY.format(date) // en-CA 는 YYYY-MM-DD 로 낸다
}

/** 'YYYY-MM-DD' → Seoul 자정에 해당하는 시각. DB 의 timestamptz 에 그대로 넣는다 */
export function seoulMidnight(day: string): Date {
  return new Date(`${day}T00:00:00+09:00`)
}

/** 저장된 값 + 이번 패치를 합쳤을 때의 최종 상태. 값이 그대로인 필드는 changed 에 안 들어간다 */
export function mergeScheduleDays(
  current: ScheduleDays,
  patch: SchedulePatch,
): { ok: true; next: ScheduleDays; changed: ScheduleField[] } | { ok: false; reason: 'invalid_date' | 'reversed_period'; detail: string } {
  const next: ScheduleDays = { ...current }
  const changed: ScheduleField[] = []

  for (const field of SCHEDULE_FIELDS) {
    if (!(field in patch)) continue // 안 보낸 필드는 건드리지 않는다
    const day = toSeoulDay(patch[field])
    if (day === undefined) return { ok: false, reason: 'invalid_date', detail: field }
    if (day === current[field]) continue // 값이 그대로면 이력을 남기지 않는다
    next[field] = day
    changed.push(field)
  }

  // 이번에 안 보낸 필드까지 합친 최종 상태로 검증한다 — contractEnd 만 보내도
  // 이미 저장된 contractStart 보다 앞이면 거부해야 한다
  if (next.contractStart && next.contractEnd && next.contractEnd < next.contractStart) {
    return { ok: false, reason: 'reversed_period', detail: `${next.contractStart} > ${next.contractEnd}` }
  }

  return { ok: true, next, changed }
}

/**
 * 계약기간·광고시작일을 확정하고 바뀐 필드마다 기록을 남긴다.
 *
 * transitionOrder() 와 같은 구조다: 풀에서 뽑은 하나의 client 위에서 UPDATE 와 이력
 * INSERT 를 한 트랜잭션으로 묶는다. 둘을 따로 커밋하면 주문의 계약기간은 바뀌었는데
 * 누가 언제 바꿨는지가 없는 행이 남고, append-only 표라 나중에 메워 넣을 수 없다.
 * Payload 훅을 타지 않고 같은 커넥션에 직접 INSERT 하는 이유도 같다 — 훅이 별도
 * 커넥션을 쓰면 트랜잭션이 나뉜다.
 *
 * 현재 값은 FOR UPDATE 로 읽는다. 두 관리자가 동시에 시작일·종료일을 각각 저장하면
 * 잠금 없이는 둘 다 "역순 아님"으로 통과해 뒤집힌 기간이 남는다.
 *
 * ⚠ 이 함수는 계약서 스냅샷(orders.contractText)을 절대 건드리지 않는다. 그 값은 고객이
 * 실제로 읽고 서명한 문서 그대로여야 하므로, 계약기간은 별도 컬럼에 저장하고 화면에서
 * 합성해 보여준다(src/lib/order-lookup.ts).
 */
export async function setOrderSchedule(
  orderId: number,
  patch: SchedulePatch,
  actorId: number | null,
): Promise<SetScheduleResult> {
  const payload = await getPayload({ config })
  const client = await payload.db.pool.connect()
  try {
    await client.query('BEGIN')

    const found = await client.query(
      `SELECT contract_start, contract_end, ad_start_date FROM orders WHERE id = $1 FOR UPDATE`,
      [orderId],
    )
    const row = found.rows[0]
    if (!row) {
      await client.query('ROLLBACK')
      return { ok: false, reason: 'not_found' }
    }

    const current: ScheduleDays = {
      contractStart: toSeoulDay(row.contract_start) ?? null,
      contractEnd: toSeoulDay(row.contract_end) ?? null,
      adStartDate: toSeoulDay(row.ad_start_date) ?? null,
    }

    const merged = mergeScheduleDays(current, patch)
    if (!merged.ok) {
      await client.query('ROLLBACK')
      return { ok: false, reason: merged.reason, detail: merged.detail }
    }
    if (merged.changed.length === 0) {
      // 쓸 것이 없으면 updated_at 도 건드리지 않는다 — 아무 일도 없었던 게 사실이다
      await client.query('ROLLBACK')
      return { ok: true, changed: [] }
    }

    const assignments = merged.changed.map((f, i) => `${COLUMN[f]} = $${i + 2}`).join(', ')
    const values = merged.changed.map((f) => (merged.next[f] ? seoulMidnight(merged.next[f]!) : null))
    await client.query(`UPDATE orders SET ${assignments}, updated_at = NOW() WHERE id = $1`, [orderId, ...values])

    const at = new Date().toISOString()
    for (const field of merged.changed) {
      await client.query(
        `INSERT INTO order_schedule_changes (order_id, field, from_value, to_value, actor_id, at, updated_at, created_at)
         VALUES ($1, $2, $3, $4, $5, $6, NOW(), NOW())`,
        [orderId, field, current[field], merged.next[field], actorId, at],
      )
    }

    await client.query('COMMIT')
    return { ok: true, changed: merged.changed }
  } catch (err) {
    await client.query('ROLLBACK')
    throw err
  } finally {
    client.release()
  }
}
