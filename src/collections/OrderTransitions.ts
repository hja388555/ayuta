import type { CollectionConfig } from 'payload'
import { isAdminRole } from '../lib/roles'
import { isVerifiedAdmin } from '../lib/admin-access'

/**
 * 주문 상태가 언제 왜 바뀌었는지의 유일한 기록.
 * append-only 다 — 수정·삭제를 열면 사고가 났을 때 추적할 근거가 사라진다.
 */
export const OrderTransitions: CollectionConfig = {
  slug: 'order-transitions',
  access: {
    read: ({ req }) => isVerifiedAdmin(req), // 전이 사유에 고객 연락 내용이 섞일 수 있다
    create: () => false, // 서버 코드만 (overrideAccess)
    update: () => false,
    delete: () => false,
    unlock: () => false,
    admin: ({ req: { user } }) => isAdminRole(user?.role),
  },
  fields: [
    { name: 'order', type: 'relationship', relationTo: 'orders', required: true, index: true },
    { name: 'fromStatus', type: 'text', required: true },
    { name: 'toStatus', type: 'text', required: true },
    { name: 'actor', type: 'relationship', relationTo: 'users' },
    { name: 'reason', type: 'text' },
    { name: 'at', type: 'date', required: true },
  ],
}
