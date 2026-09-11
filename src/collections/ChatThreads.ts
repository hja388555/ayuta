import { APIError, type CollectionConfig } from 'payload'
import { hasThreadOwner } from '../lib/chat/guest'

/**
 * 1:1 채팅 방(큐 Q37). 회원은 한 명당 방 하나(customer unique).
 * 비회원 방(2026-09-12)은 customer 가 비고 guest* 칸이 채워진다 — 쿠키·채팅 링크 토큰의 해시(guestTokenHash)로만 찾는다.
 * 관리자가 문의 카드에서 연 비회원 방은 inquiry 로 문의 하나당 방 하나다.
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
  hooks: {
    beforeValidate: [
      ({ data, originalDoc }) => {
        // 주인 없는 방은 누구도 열 수 없는 방이다 — 회원 또는 비회원 이름·이메일 중 하나는 있어야 한다
        if (!hasThreadOwner(data, originalDoc)) throw new APIError('chat_thread_owner_required', 400)
        return data
      },
    ],
  },
  fields: [
    { name: 'customer', type: 'relationship', relationTo: 'users', unique: true, index: true },
    // 비회원 방 — 시작 폼(또는 문의)의 이름·이메일·연락처
    { name: 'guestName', type: 'text' },
    { name: 'guestEmail', type: 'text' },
    { name: 'guestPhone', type: 'text' },
    // 쿠키·채팅 링크 토큰의 SHA-256. 링크를 새로 발급하면 바뀐다(이전 링크·쿠키는 끊긴다)
    { name: 'guestTokenHash', type: 'text', unique: true, index: true },
    // 방을 만든 요청의 IP HMAC. 시간당 생성 수 제한에만 쓴다(원문 IP 는 저장하지 않는다)
    { name: 'guestIpHash', type: 'text', index: true },
    { name: 'guestPrivacyConsentAt', type: 'date' },
    // 관리자가 문의 카드의 "채팅 열기"로 만든 비회원 방
    { name: 'inquiry', type: 'relationship', relationTo: 'inquiries', unique: true, index: true },
    // 방을 만든 화면의 언어. 관리자 답장을 어느 언어로 번역할지 정한다
    { name: 'locale', type: 'select', required: true, defaultValue: 'ko', options: ['ko', 'ja'] },
    { name: 'status', type: 'select', required: true, defaultValue: 'open', options: ['open', 'closed'] },
    { name: 'lastMessageAt', type: 'date', index: true },
    { name: 'unreadForAdmin', type: 'number', required: true, defaultValue: 0 },
    { name: 'unreadForCustomer', type: 'number', required: true, defaultValue: 0 },
  ],
  timestamps: true,
}
