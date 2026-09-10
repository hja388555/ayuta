// order_counters는 Payload 컬렉션이 아니라 순수 SQL 테이블이라 drizzle auto-push가
// 만들어 주지 않는다. 이 스크립트가 저장소에 체크인된 유일한 스키마 출처다 — 손으로
// psql에 친 DDL은 CI도, 새로 clone한 개발자도 재현할 수 없다.
// 마이그레이션 파일이 아니다: Q31이 단일 `migrate:create`로 이 DDL을 그대로 가져간다.
//
// 대리키(id serial)를 쓰는 이유: 복합 기본키(scope, day)는 drizzle-kit의 dev-mode
// auto-push가 매 기동마다 실행하는 기본키 introspect 쿼리를 깨뜨린다
// ("there is no parameter $1") — Payload가 모르는 테이블에 단일 id 컬럼이 없는
// 복합 PK가 있으면 재현된다. UNIQUE (scope, day)는 유지되므로
// order-counter.ts의 `ON CONFLICT (scope, day)`는 그대로 이 제약에 바인딩된다.
import { getPayload } from 'payload'
import config from '../src/payload.config.js'

export async function ensureOrderCounters(pool: { query: (sql: string) => Promise<unknown> }): Promise<void> {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS order_counters (
      id serial PRIMARY KEY,
      scope text NOT NULL,
      day text NOT NULL,
      seq integer NOT NULL DEFAULT 0,
      UNIQUE (scope, day)
    )
  `)
}

const isMain = process.argv[1]?.endsWith('ensure-order-counters.ts') || process.argv[1]?.endsWith('ensure-order-counters.js')
if (isMain) {
  const main = async () => {
    const payload = await getPayload({ config })
    await ensureOrderCounters(payload.db.pool)
    console.log('order_counters 준비 완료')
    process.exit(0)
  }
  main().catch((err) => {
    console.error(err)
    process.exit(1)
  })
}
