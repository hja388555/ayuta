import type { CollectionConfig } from 'payload'
import { isAdminRole } from '../lib/roles'
import { isActiveAdmin } from '../lib/admin-access'

/**
 * 관리자가 주문 건으로 고객과 연락한 내용을 남기는 메모.
 * order-transitions 와 같은 append-only 다 — 분쟁이 났을 때 "그때 뭐라고 안내했나"의
 * 근거가 되는 기록이라, 사후에 고치거나 지울 수 있으면 근거로서의 가치가 사라진다.
 * 그래서 update · delete · unlock 을 전부 닫는다.
 */
export const OrderNotes: CollectionConfig = {
  slug: 'order-notes',
  admin: {
    useAsTitle: 'body',
    defaultColumns: ['order', 'body', 'author', 'createdAt'],
  },
  access: {
    // 관리자만(탈퇴 계정 제외) — REST·GraphQL 도 /manage 와 같은 판정을 탄다
    read: ({ req }) => isActiveAdmin(req),
    create: ({ req }) => isActiveAdmin(req),
    update: () => false, // 감사 기록 — 사후 수정 금지
    delete: () => false, // 감사 기록 — 사후 삭제 금지
    unlock: () => false,
    admin: ({ req: { user } }) => isAdminRole(user?.role),
  },
  hooks: {
    beforeChange: [
      ({ data, req }) => {
        // author 는 서버가 아는 로그인 주체로만 정해진다. 클라이언트가 보낸 author 값을
        // 그대로 믿으면 남의 이름으로 메모를 남길 수 있어 기록 자체가 못 믿을 것이 된다.
        // (요청에 사용자가 없는 서버 경로에서는 author 를 비운다 — 남의 값을 물려받지 않는다)
        return { ...data, author: req.user?.id ?? null }
      },
    ],
  },
  fields: [
    { name: 'order', type: 'relationship', relationTo: 'orders', required: true, index: true },
    {
      name: 'body',
      type: 'textarea',
      required: true,
      // required 만으로는 공백 한 칸짜리 메모가 통과한다 — 빈 기록은 기록이 아니다
      validate: (value: unknown) =>
        typeof value === 'string' && value.trim().length > 0 ? true : '메모 내용을 입력해라',
    },
    // beforeChange 가 강제로 채운다. 클라이언트가 보낸 값은 무시된다
    { name: 'author', type: 'relationship', relationTo: 'users', admin: { readOnly: true } },
  ],
  // createdAt / updatedAt 은 Payload 기본 타임스탬프를 그대로 쓴다
  timestamps: true,
}
