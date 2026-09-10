import type { CollectionConfig } from 'payload'
import { isAdminRole, isSuperRole } from '../lib/roles'

// 결제 계획의 다섯 상태에
// in_progress · done 두 상태를 더한다 — 견적/주문 스파인 계획이 요구하는 전체 상태다.
export const ORDER_STATUSES = [
  'pending',
  'paid',
  'in_progress',
  'done',
  'failed',
  'cancelled',
  'fraud_suspected',
] as const
export type OrderStatus = (typeof ORDER_STATUSES)[number]

export const Orders: CollectionConfig = {
  slug: 'orders',
  access: {
    // 주문 조회는 전부 서버 코드(DAL)를 거친다. REST 로는 아무도 못 읽는다
    read: ({ req: { user } }) => isAdminRole(user?.role),
    create: () => false, // Server Action 의 payload.create 만 쓴다 (overrideAccess)
    update: ({ req: { user } }) => isAdminRole(user?.role),
    delete: ({ req: { user } }) => isSuperRole(user?.role), // 전자상거래법 제6조: 실제로는 지우지 않는다
    unlock: () => false,
    admin: ({ req: { user } }) => isAdminRole(user?.role),
  },
  fields: [
    { name: 'orderNumber', type: 'text', required: true, unique: true, index: true },
    // 포트원에 넘긴 결제 식별자. 웹훅과 복귀 경로가 이 값으로 주문을 찾는다
    { name: 'paymentId', type: 'text', required: true, unique: true, index: true },
    {
      name: 'status',
      type: 'select',
      required: true,
      defaultValue: 'pending',
      index: true,
      options: ORDER_STATUSES.map((s) => ({ label: s, value: s })),
    },
    { name: 'currency', type: 'select', required: true, options: ['KRW', 'JPY'] },
    // 정수 최소단위. 원 = 1, 엔 = 1
    { name: 'amount', type: 'number', required: true },
    { name: 'locale', type: 'select', required: true, options: ['ko', 'ja'] },
    {
      // 금액과 항목명을 값으로 복사해 둔다.
      // 단가 ID만 참조하면 관리자가 단가를 고치는 순간 과거 주문 금액이 전부 바뀐다
      name: 'items',
      type: 'array',
      required: true,
      fields: [
        { name: 'code', type: 'text', required: true },
        { name: 'label', type: 'text', required: true },
        { name: 'unitAmount', type: 'number', required: true },
        { name: 'quantity', type: 'number', required: true, defaultValue: 1 },
      ],
    },
    { name: 'customer', type: 'relationship', relationTo: 'users', hasMany: false },
    {
      // 비회원 주문. customer 가 없을 때 이 값들로 본인 확인을 한다
      name: 'guest',
      type: 'group',
      fields: [
        { name: 'name', type: 'text' },
        { name: 'phone', type: 'text' },
        { name: 'email', type: 'email' },
        { name: 'postcode', type: 'text' },
        { name: 'address1', type: 'text' },
        { name: 'address2', type: 'text' },
      ],
    },
    { name: 'paidAt', type: 'date' },
    { name: 'failReason', type: 'text' },
  ],
}
