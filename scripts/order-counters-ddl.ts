// order_counters는 Payload 컬렉션이 아니라 순수 SQL 테이블이다. 이 파일이 저장소에
// 체크인된 유일한 DDL 출처다 — 손으로 psql에 친 DDL은 CI도, 새로 clone한 개발자도 재현할 수
// 없다. 마이그레이션 파일이 아니다: Q31이 단일 `migrate:create`로 이 DDL을 그대로 가져간다.
//
// 대리키(id serial)를 쓰는 이유: 복합 기본키(scope, day)는 drizzle-kit의 dev-mode
// auto-push가 매 기동마다 실행하는 기본키 introspect 쿼리를 깨뜨린다
// ("there is no parameter $1") — Payload가 모르는 테이블에 단일 id 컬럼이 없는
// 복합 PK가 있으면 재현된다. UNIQUE (scope, day)는 유지되므로
// order-counter.ts의 `ON CONFLICT (scope, day)`는 그대로 이 제약에 바인딩된다.
//
// 실행 진입점(scripts/ensure-order-counters.ts)과 분리해 둔다. 진입점은 top-level await로
// 끝날 때까지 기다려야 하는데, 그러면 import 하는 순간 실행된다 — 통합 테스트가 이
// 함수만 가져다 쓸 수 있도록 여기에는 실행 코드를 두지 않는다.
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
