import path from 'path'
import { fileURLToPath } from 'url'
import { buildConfig } from 'payload'
import { postgresAdapter } from '@payloadcms/db-postgres'
import { poolConfig } from './lib/db-pool'
import { lexicalEditor } from '@payloadcms/richtext-lexical'
import { integer, pgTable, serial, text, unique } from 'drizzle-orm/pg-core'

import { Users } from './collections/Users'
import { PriceEntries } from './collections/PriceEntries'
import { Orders } from './collections/Orders'
import { OrderTransitions } from './collections/OrderTransitions'
import { OrderNotes } from './collections/OrderNotes'
import { OrderScheduleChanges } from './collections/OrderScheduleChanges'
import { ContractTemplates } from './collections/ContractTemplates'
import { Inquiries } from './collections/Inquiries'
import { InquiryFiles } from './collections/InquiryFiles'
import { Quotes } from './collections/Quotes'
import { AdminLoginLogs } from './collections/AdminLoginLogs'
import { BrandAssets } from './collections/BrandAssets'
import { LegalDocuments } from './collections/LegalDocuments'
import { LegalRevisions } from './collections/LegalRevisions'
import { CompanySettings } from './globals/CompanySettings'
import { PricingSettings } from './globals/PricingSettings'

const dirname = path.dirname(fileURLToPath(import.meta.url))

export default buildConfig({
  admin: {
    user: Users.slug,
    importMap: { baseDir: path.resolve(dirname) },
  },
  collections: [
    Users,
    PriceEntries,
    Orders,
    OrderTransitions,
    OrderNotes,
    OrderScheduleChanges,
    ContractTemplates,
    Inquiries,
    InquiryFiles,
    Quotes,
    AdminLoginLogs,
    BrandAssets,
    LegalDocuments,
    LegalRevisions,
  ],
  globals: [PricingSettings, CompanySettings],
  editor: lexicalEditor(),
  secret: process.env.PAYLOAD_SECRET || '',
  typescript: { outputFile: path.resolve(dirname, 'payload-types.ts') },
  db: postgresAdapter({
    // 운영은 DATABASE_CA_CERT 로 인증서를 검증해 접속한다(src/lib/db-pool.ts)
    pool: poolConfig(process.env.DATABASE_URI || '', process.env.DATABASE_CA_CERT),
    // 운영 스키마는 마이그레이션으로만 바꾼다(큐 Q31). 개발 모드의 자동 반영(push)은 운영 DB 에서
    // RLS 를 꺼 버리고, 컬럼 삭제 같은 변경을 묻지도 않고 적용할 수 있다. 로컬·CI 는 그대로 push 한다.
    // PAYLOAD_DB_PUSH=false 로 로컬에서도 끌 수 있다(운영 DB 에 스크립트를 돌릴 때)
    push: process.env.NODE_ENV !== 'production' && process.env.PAYLOAD_DB_PUSH !== 'false',
    migrationDir: path.resolve(dirname, 'migrations'),
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
