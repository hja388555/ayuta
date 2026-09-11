// 운영 DB(Supabase) 모든 public 테이블의 RLS 를 켜고 공개 역할 권한을 회수한다(큐 Q31). `pnpm db:rls`
//
// 왜 필요한가: 앱은 postgres 역할(BYPASSRLS)로만 접속하므로 RLS 는 앱 동작과 무관하다. 대신
// Supabase 의 공개 역할(anon·authenticated)이 Data API 로 테이블을 읽는 길을 막는 마지막 벽이다.
// Payload 마이그레이션은 RLS 를 모르고, 새 테이블은 RLS 가 꺼진 채 생긴다 — 배포할 때마다
// 마이그레이션 직후 이 스크립트를 돌린다(package.json vercel-build). 몇 번을 돌려도 결과가 같다.
//
// anon·authenticated 역할이 없는 DB(로컬 docker·CI)에서는 권한 회수를 건너뛴다.
import { getPayload } from 'payload'
import config from '../src/payload.config.js'

const main = async () => {
  const payload = await getPayload({ config })
  const pool = payload.db.pool
  await pool.query(`DO $$
    DECLARE r record;
    BEGIN
      FOR r IN SELECT tablename FROM pg_tables WHERE schemaname = 'public' LOOP
        EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', r.tablename);
      END LOOP;
      IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') AND EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
        REVOKE ALL ON ALL TABLES IN SCHEMA public FROM anon, authenticated;
        REVOKE ALL ON ALL SEQUENCES IN SCHEMA public FROM anon, authenticated;
        REVOKE ALL ON ALL FUNCTIONS IN SCHEMA public FROM anon, authenticated;
      END IF;
    END $$`)
  const { rows } = await pool.query(
    `SELECT count(*) FILTER (WHERE NOT c.relrowsecurity)::int AS off, count(*)::int AS total
       FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
      WHERE n.nspname = 'public' AND c.relkind = 'r'`,
  )
  console.log(`RLS: ${rows[0].total - rows[0].off}/${rows[0].total} 테이블 켜짐`)
  if (rows[0].off > 0) throw new Error('RLS 가 꺼진 테이블이 남았다')
  await payload.destroy()
}

// payload run은 import()가 끝나는 즉시 프로세스를 종료시킨다 — top-level await 로 붙잡아 둔다
try {
  await main()
} catch (err) {
  console.error(err)
  process.exit(1)
}
