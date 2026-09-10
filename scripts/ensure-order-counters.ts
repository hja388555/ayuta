// `pnpm db:bootstrap` 진입점 — order_counters 테이블을 만든다(DDL 은 order-counters-ddl.ts).
//
// payload run 은 스크립트를 import 한 직후 process.exit(0) 을 부르고, 그 전에 process.argv[1]
// 을 payload 바이너리 경로로 바꿔 둔다. 예전 구현은 "argv[1] 이 이 파일이면 main() 실행" 으로
// 판정한 뒤 main() 을 await 하지 않았다 — 판정은 항상 거짓이었고, 참이었어도 exit 에 끊겼다.
// 그래서 db:bootstrap 은 아무것도 하지 않고 성공(exit 0)으로 끝났다. seed-*.ts 와 같이
// top-level await 로 main() 이 끝날 때까지 모듈 평가 자체를 붙잡아 둔다.
import { getPayload } from 'payload'
import config from '../src/payload.config.js'
import { ensureOrderCounters } from './order-counters-ddl.js'

const main = async () => {
  const payload = await getPayload({ config })
  await ensureOrderCounters(payload.db.pool)
  // 실제로 만들어졌는지 DB 에 다시 묻는다 — "성공으로 끝났는데 아무것도 안 했다"가 이
  // 스크립트가 겪은 실패였다. 테이블이 없으면 exit 1 로 CI 를 멈춘다
  const { rows } = (await payload.db.pool.query(`SELECT to_regclass('public.order_counters') IS NOT NULL AS ok`)) as {
    rows: Array<{ ok: boolean }>
  }
  if (!rows[0]?.ok) throw new Error('order_counters 테이블이 만들어지지 않았다')
  console.log('order_counters 준비 완료')
  await payload.destroy()
}

try {
  await main()
} catch (err) {
  console.error(err)
  process.exit(1)
}
