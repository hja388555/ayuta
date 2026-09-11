import type { CollectionConfig } from 'payload'

/**
 * 1:1 채팅 메시지(큐 Q37). 원문(body)과 번역(translatedBody)을 함께 저장한다 —
 * 번역이 실패해도 원문은 남는다(translationStatus 'failed').
 * 접근 제어는 ChatThreads 와 같다: REST 전부 닫고 라우트 핸들러의 Local API 로만.
 * 첨부는 아직 없다(화면의 첨부 버튼은 "준비 중").
 */
export const ChatMessages: CollectionConfig = {
  slug: 'chat-messages',
  access: {
    create: () => false,
    read: () => false,
    update: () => false,
    delete: () => false,
    unlock: () => false,
    admin: () => false,
  },
  fields: [
    { name: 'thread', type: 'relationship', relationTo: 'chat-threads', required: true, index: true },
    { name: 'sender', type: 'select', required: true, options: ['customer', 'admin'] },
    { name: 'senderUser', type: 'relationship', relationTo: 'users' },
    // 보낸 계정이 지워져도 누가 보냈는지 남긴다
    { name: 'senderEmail', type: 'text' },
    { name: 'body', type: 'textarea', required: true, maxLength: 2000 },
    { name: 'sourceLang', type: 'text' },
    { name: 'translatedBody', type: 'textarea' },
    { name: 'translatedLang', type: 'text' },
    { name: 'translationStatus', type: 'select', required: true, defaultValue: 'skipped', options: ['ok', 'failed', 'skipped'] },
  ],
  timestamps: true,
}
