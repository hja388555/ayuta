import path from 'path'
import { fileURLToPath } from 'url'
import { buildConfig } from 'payload'
import { postgresAdapter } from '@payloadcms/db-postgres'
import { lexicalEditor } from '@payloadcms/richtext-lexical'
import { integer, pgTable, serial, text, unique } from 'drizzle-orm/pg-core'

import { Users } from './collections/Users'
import { AdminOtps } from './collections/AdminOtps'
import { PriceEntries } from './collections/PriceEntries'
import { Orders } from './collections/Orders'
import { OrderTransitions } from './collections/OrderTransitions'
import { OrderNotes } from './collections/OrderNotes'
import { OrderScheduleChanges } from './collections/OrderScheduleChanges'
import { ContractTemplates } from './collections/ContractTemplates'
import { PricingSettings } from './globals/PricingSettings'

const dirname = path.dirname(fileURLToPath(import.meta.url))

export default buildConfig({
  admin: {
    user: Users.slug,
    importMap: { baseDir: path.resolve(dirname) },
  },
  collections: [Users, AdminOtps, PriceEntries, Orders, OrderTransitions, OrderNotes, OrderScheduleChanges, ContractTemplates],
  globals: [PricingSettings],
  editor: lexicalEditor(),
  secret: process.env.PAYLOAD_SECRET || '',
  typescript: { outputFile: path.resolve(dirname, 'payload-types.ts') },
  db: postgresAdapter({
    pool: { connectionString: process.env.DATABASE_URI || '', max: 10 },
    // order_counters 는 Payload 컬렉션이 아니라 순수 SQL 테이블(주문번호 카운터)이다.
    // drizzle 이 이 테이블을 스키마에서 모르면 dev 모드가 매번 "미등록 테이블을 지울까요?"
    // 를 물어본다 — 잘못 수락하면 카운터가 1부터 다시 시작해 이미 발급된 주문번호와 충돌한다.
    // 여기 등록만 해서 drizzle 에게 "이 테이블은 존재해야 한다"고 알려주고, 프롬프트를 끈다.
    afterSchemaInit: [
      ({ schema }) => {
        const orderCounters = pgTable(
          'order_counters',
          {
            id: serial('id').primaryKey(),
            scope: text('scope').notNull(),
            day: text('day').notNull(),
            seq: integer('seq').notNull().default(0),
          },
          (t) => ({
            // 이름을 scripts/ensure-order-counters.ts 가 실제로 만든 제약 이름과 맞춘다.
            // 이름이 다르면 drizzle이 "새 제약을 추가할까요?"를 또 물어본다
            scopeDayUnique: unique('order_counters_scope_day_key').on(t.scope, t.day),
          }),
        )
        return {
          ...schema,
          tables: { ...schema.tables, order_counters: orderCounters },
        }
      },
    ],
  }),
  sharp: undefined,
})
