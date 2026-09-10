import type { CollectionConfig } from 'payload'
import { isActiveSuper } from '../lib/admin-access'

/**
 * 관리자 계정 로그인 기록(요구사항 1-16 보안 규칙 5 — "관리자 계정의 로그인 시각·IP를 기록한다").
 * 2단계 인증이 없는 만큼(2026-09-11 결정) 계정이 새었을 때 언제 어디서 들어왔는지 추적할
 * 근거가 이것뿐이다. append-only — 사후에 고치거나 지울 수 있으면 추적 근거가 못 된다.
 * 쓰기는 Users 의 afterLogin 훅(overrideAccess)만 한다. 읽기는 최고관리자만.
 */
export const AdminLoginLogs: CollectionConfig = {
  slug: 'admin-login-logs',
  admin: { useAsTitle: 'at', defaultColumns: ['user', 'at', 'ip'] },
  access: {
    create: () => false,
    read: ({ req }) => isActiveSuper(req),
    update: () => false,
    delete: () => false,
    unlock: () => false,
    admin: ({ req }) => isActiveSuper(req),
  },
  fields: [
    // 필수로 두지 않는다 — 관리자 계정을 지워도 기록은 남아야 한다(필수면 계정 삭제가 막히고,
    // 연쇄 삭제면 기록이 사라진다). 계정이 지워지면 user 는 비고 아래 email 스냅샷이 남는다
    { name: 'user', type: 'relationship', relationTo: 'users', index: true },
    { name: 'email', type: 'text', required: true },
    { name: 'at', type: 'date', required: true, index: true },
    { name: 'ip', type: 'text' },
    { name: 'userAgent', type: 'text' },
  ],
}
