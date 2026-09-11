import type { CollectionConfig } from 'payload'
import { isActiveSuper } from '../lib/admin-access'

/**
 * 관리자 초대(메일 링크로 계정 만들기). 쓰기는 서버 경로(/api/admin/accounts/invite, /api/invite/accept)가
 * Local API(overrideAccess)로만 한다 — REST 로는 최고관리자 조회만 열린다.
 * 원본 토큰은 저장하지 않는다. tokenHash(sha256)만 두고, 그마저 응답에는 싣지 않는다.
 */
export const AdminInvites: CollectionConfig = {
  slug: 'admin-invites',
  admin: { useAsTitle: 'email', defaultColumns: ['email', 'role', 'expiresAt', 'usedAt'] },
  access: {
    create: () => false,
    read: ({ req }) => isActiveSuper(req),
    update: () => false,
    delete: () => false,
    unlock: () => false,
    admin: ({ req }) => isActiveSuper(req),
  },
  fields: [
    { name: 'email', type: 'email', required: true, index: true },
    { name: 'role', type: 'select', required: true, options: ['manager', 'super'].map((r) => ({ label: r, value: r })) },
    { name: 'tokenHash', type: 'text', required: true, unique: true, access: { read: () => false } },
    { name: 'expiresAt', type: 'date', required: true },
    { name: 'usedAt', type: 'date' },
    { name: 'invitedBy', type: 'relationship', relationTo: 'users' },
  ],
}
