import path from 'path'
import { fileURLToPath } from 'url'
import { buildConfig } from 'payload'
import { postgresAdapter } from '@payloadcms/db-postgres'
import { poolConfig } from './lib/db-pool'
import { s3Storage } from '@payloadcms/storage-s3'
import { S3_PREFIX, s3ClientConfig, s3Enabled } from './lib/uploads/s3-config'
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
import { AdminInvites } from './collections/AdminInvites'
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
    AdminInvites,
    BrandAssets,
    LegalDocuments,
    LegalRevisions,
  ],
  globals: [PricingSettings, CompanySettings],
  editor: lexicalEditor(),
  secret: process.env.PAYLOAD_SECRET || '',
  typescript: { outputFile: path.resolve(dirname, 'payload-types.ts') },
  // 업로드(문의 첨부·도장)를 Supabase Storage 비공개 버킷에 저장한다(큐 Q31 2단계). Vercel 은 디스크가
  // 요청마다 사라진다. S3_ENABLED=true 일 때만 켠다(src/lib/uploads/s3-config.ts) — 로컬·CI 는 디스크.
  // alwaysInsertFields: 켜지든 꺼지든 스키마(prefix 열)가 같아야 마이그레이션 하나로 모든 환경이 맞는다.
  // 파일 URL 은 Payload 접근 제어(read access)를 거친다 — 버킷 공개 주소는 없다
  plugins: [
    s3Storage({
      enabled: s3Enabled(),
      alwaysInsertFields: true,
      acl: 'private',
      bucket: process.env.S3_BUCKET || '',
      config: s3ClientConfig(),
      collections: {
        'inquiry-files': { prefix: S3_PREFIX['inquiry-files'] },
        'brand-assets': { prefix: S3_PREFIX['brand-assets'] },
      },
    }),
  ],
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
