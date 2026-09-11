import type { CollectionConfig } from 'payload'

/**
 * 1:1 채팅 방(큐 Q37). 고객 한 명당 방 하나(customer unique).
 * REST·GraphQL 은 전부 닫는다 — 읽기·쓰기는 /api/chat·/api/admin/chat 라우트가 소유권·관리자
 * 판정을 한 뒤 Local API 로만 한다. 열어 두면 판정을 건너뛴 경로가 하나 더 생긴다.
 */
export const ChatThreads: CollectionConfig = {
  slug: 'chat-threads',
  access: {
    create: () => false,
    read: () => false,
    update: () => false,
    delete: () => false,
    unlock: () => false,
    admin: () => false,
  },
  fields: [
    { name: 'customer', type: 'relationship', relationTo: 'users', required: true, unique: true, index: true },
    // 방을 만든 화면의 언어. 관리자 답장을 어느 언어로 번역할지 정한다
    { name: 'locale', type: 'select', required: true, defaultValue: 'ko', options: ['ko', 'ja'] },
    { name: 'status', type: 'select', required: true, defaultValue: 'open', options: ['open', 'closed'] },
    { name: 'lastMessageAt', type: 'date', index: true },
    { name: 'unreadForAdmin', type: 'number', required: true, defaultValue: 0 },
    { name: 'unreadForCustomer', type: 'number', required: true, defaultValue: 0 },
  ],
  timestamps: true,
}
