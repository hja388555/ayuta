import type { CollectionConfig } from 'payload'
import { isActiveAdmin } from '../lib/admin-access'

export const QUOTE_STATUSES = ['issued', 'revoked'] as const
export type QuoteStatus = (typeof QUOTE_STATUSES)[number]

/**
 * 5번 견적(요구사항 1-12). 관리자가 문의를 보고 발행하고, 고객은 토큰 링크로 본다.
 *
 * - 만드는 경로·회수 경로는 관리자 API(/api/admin/quotes, /api/admin/quotes/revoke) 뿐이다.
 *   REST create/update 를 닫는다 — 합계 재계산·이전 링크 회수를 건너뛴 견적이 생기지 않게.
 * - 발행 후 라인·합계는 바뀌지 않는다(고객이 본 금액이 흔들리면 안 된다). 고치려면 회수하고
 *   새로 발행한다.
 * - 토큰 원문은 저장하지 않는다. tokenHash 는 관리자에게도 내보내지 않는다(필드 read 차단).
 * - 만료는 expiresAt 으로 판단한다(상태를 따로 바꾸지 않는다 — 시계가 곧 상태다).
 */
export const Quotes: CollectionConfig = {
  slug: 'quotes',
  admin: { useAsTitle: 'quoteNumber', defaultColumns: ['quoteNumber', 'inquiry', 'total', 'status', 'expiresAt'] },
  access: {
    create: () => false,
    read: ({ req }) => isActiveAdmin(req),
    update: () => false,
    delete: () => false,
    unlock: () => false,
    admin: ({ req }) => isActiveAdmin(req),
  },
  fields: [
    { name: 'quoteNumber', type: 'text', required: true, unique: true, index: true },
    { name: 'inquiry', type: 'relationship', relationTo: 'inquiries', required: true, index: true },
    {
      name: 'lines',
      type: 'array',
      required: true,
      fields: [
        { name: 'label', type: 'text', required: true },
        { name: 'quantity', type: 'number', required: true },
        { name: 'unitAmount', type: 'number', required: true },
      ],
    },
    { name: 'currency', type: 'select', required: true, options: ['KRW', 'JPY'] },
    // 정수 최소단위. 서버가 lines 로 계산한 값만 들어간다(src/lib/quotes/lines.ts)
    { name: 'total', type: 'number', required: true },
    { name: 'tokenHash', type: 'text', required: true, unique: true, index: true, access: { read: () => false } },
    {
      name: 'status',
      type: 'select',
      required: true,
      defaultValue: 'issued',
      index: true,
      options: QUOTE_STATUSES.map((s) => ({ label: s, value: s })),
    },
    { name: 'issuedAt', type: 'date', required: true },
    { name: 'expiresAt', type: 'date', required: true },
    { name: 'issuedBy', type: 'relationship', relationTo: 'users' },
    { name: 'revokedAt', type: 'date' },
  ],
  timestamps: true,
}
