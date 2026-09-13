import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  // focus_y 컬럼 삭제는 이번 배포에서 보류한다 — migrate 후 next build 전 배포 창에서
  // 구버전 코드가 이 컬럼을 참조할 수 있어 컬럼 삭제는 다음 배포에서 진행한다.
  await db.execute(sql`SELECT 1;`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  // up에서 컬럼을 지우지 않았으므로 되돌릴 것도 없다.
  await db.execute(sql`SELECT 1;`)
}
