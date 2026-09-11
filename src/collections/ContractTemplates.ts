import type { CollectionConfig } from 'payload'
import { isActiveAdmin, isActiveSuper } from '../lib/admin-access'
import { recordLegalRevision } from './LegalRevisions'

export const ContractTemplates: CollectionConfig = {
  slug: 'contract-templates',
  admin: { useAsTitle: 'title' },
  access: {
    // 결제 전 고객이 계약서 전문을 직접 읽어야 하므로 공개
    read: () => true,
    // 계약서 수정은 법적 문서를 바꾸는 일이다
    create: ({ req }) => isActiveSuper(req),
    update: ({ req }) => isActiveSuper(req),
    // 계약서를 지우면 그 계약서를 참조한 과거 주문의 근거가 사라진다.
    // 내릴 때는 active: false 로 내린다
    delete: () => false,
    unlock: () => false,
    admin: ({ req }) => isActiveAdmin(req),
  },
  // 관리자 화면(/manage/legal)에서 문구를 고치면 이력이 남는다(큐 Q25 2차)
  hooks: { afterChange: [recordLegalRevision('contract-templates', (doc) => `${doc.category}번 계약서 (${doc.locale})`)] },
  fields: [
    { name: 'category', type: 'number', required: true, min: 1, max: 5, index: true },
    { name: 'locale', type: 'select', required: true, options: ['ko', 'ja'], index: true },
    { name: 'title', type: 'text', required: true },
    // 빈칸은 {{productName}} {{items}} {{amount}} {{contractDate}} {{buyerName}} {{signature}}
    // 형태로 둔다 — packages/pricing/src/contract.ts 의 fillContract 가 치환한다
    { name: 'body', type: 'textarea', required: true },
    {
      // 동의 항목 수는 계약서마다 다르다(1·2번 1개, 4번 3개). 화면에 개수를 하드코딩하지
      // 않도록 데이터로 둔다
      name: 'consents',
      type: 'array',
      required: true,
      fields: [
        { name: 'key', type: 'text', required: true },
        { name: 'label', type: 'text', required: true },
        { name: 'required', type: 'checkbox', required: true, defaultValue: true },
      ],
    },
    { name: 'active', type: 'checkbox', required: true, defaultValue: true, index: true },
  ],
  // 카테고리·언어 조합당 행은 하나다. 버전을 내릴 땐 active:false 로 두고 시드가 그 행을
  // 갱신한다 — 그래야 "카테고리+언어" 조회가 항상 한 건으로 끝난다
  indexes: [{ fields: ['category', 'locale'], unique: true }],
}
