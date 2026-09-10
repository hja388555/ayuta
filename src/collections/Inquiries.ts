import type { CollectionConfig } from 'payload'
import { isActiveAdmin } from '../lib/admin-access'

export const INQUIRY_STATUSES = ['new', 'quoted', 'closed'] as const
export type InquiryStatus = (typeof INQUIRY_STATUSES)[number]

/**
 * 5번(기타 광고) 문의. 금액이 정해져 있지 않아 계산기 대신 관리자가 이 문의를 보고 견적을
 * 발행한다(Q14-B, 요구사항 1-12). 연락처·내용이 담기므로 읽기는 관리자만.
 *
 * 만드는 경로는 제출 API(POST /api/inquiries) 하나다 — 유형 대조·첨부 매직바이트 확인을
 * 거치지 않은 문의가 REST 로 들어오지 않도록 create 를 닫는다.
 */
export const Inquiries: CollectionConfig = {
  slug: 'inquiries',
  admin: { useAsTitle: 'name', defaultColumns: ['name', 'type', 'status', 'createdAt'] },
  access: {
    create: () => false,
    read: ({ req }) => isActiveAdmin(req),
    update: ({ req }) => isActiveAdmin(req),
    delete: () => false,
    unlock: () => false,
    admin: ({ req }) => isActiveAdmin(req),
  },
  fields: [
    // 문의 유형 = 카테고리 슬러그(src/lib/categories.ts). 비워 둘 수 있다(1-18: 모르면 미선택)
    { name: 'type', type: 'text', index: true },
    { name: 'body', type: 'textarea', required: true },
    { name: 'region', type: 'text' },
    { name: 'name', type: 'text', required: true },
    { name: 'phone', type: 'text', required: true },
    { name: 'email', type: 'email', required: true },
    { name: 'locale', type: 'select', options: ['ko', 'ja'], required: true },
    // 로그인한 채로 문의했으면 그 계정. 비회원 문의는 비어 있다
    { name: 'customer', type: 'relationship', relationTo: 'users' },
    { name: 'files', type: 'relationship', relationTo: 'inquiry-files', hasMany: true },
    {
      name: 'status',
      type: 'select',
      required: true,
      defaultValue: 'new',
      index: true,
      options: INQUIRY_STATUSES.map((s) => ({ label: s, value: s })),
    },
  ],
  timestamps: true,
}
