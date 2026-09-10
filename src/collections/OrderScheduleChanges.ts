import type { CollectionConfig } from 'payload'
import { isAdminRole } from '../lib/roles'
import { isVerifiedAdmin } from '../lib/admin-access'

/**
 * 계약기간·광고시작일이 언제 누구에 의해 어떻게 바뀌었는지의 기록.
 * order-transitions · order-notes 와 같은 append-only 다 — 계약기간은 분쟁의 핵심 사실이라
 * "언제 무엇에서 무엇으로 바꿨나"가 사후에 고쳐질 수 있으면 근거로 쓸 수 없다.
 *
 * from/to 를 date 가 아니라 text('YYYY-MM-DD' 또는 null)로 담는 이유: 기록은 "그때 저장한
 * 값"의 사본이지 다시 계산할 대상이 아니다. 타임존 해석이 바뀌어도 기록은 흔들리면 안 된다.
 */
export const OrderScheduleChanges: CollectionConfig = {
  slug: 'order-schedule-changes',
  admin: {
    useAsTitle: 'field',
    defaultColumns: ['order', 'field', 'fromValue', 'toValue', 'actor', 'at'],
  },
  access: {
    // 2단계 인증까지 확인한다 — role 만 보면 REST·GraphQL 이 /manage 게이트의 우회로가 된다
    read: ({ req }) => isVerifiedAdmin(req),
    create: ({ req }) => isVerifiedAdmin(req),
    update: () => false, // 감사 기록 — 사후 수정 금지
    delete: () => false, // 감사 기록 — 사후 삭제 금지
    unlock: () => false,
    admin: ({ req: { user } }) => isAdminRole(user?.role),
  },
  fields: [
    { name: 'order', type: 'relationship', relationTo: 'orders', required: true, index: true },
    {
      name: 'field',
      type: 'select',
      required: true,
      options: ['contractStart', 'contractEnd', 'adStartDate'],
    },
    // 비어 있던 값에서 처음 정해지는 경우가 정상 경로라 fromValue 는 null 이 될 수 있다.
    // toValue 도 마찬가지 — 잘못 넣은 날짜를 다시 비우는 것도 기록으로 남아야 한다
    { name: 'fromValue', type: 'text' },
    { name: 'toValue', type: 'text' },
    { name: 'actor', type: 'relationship', relationTo: 'users' },
    { name: 'at', type: 'date', required: true },
  ],
}
