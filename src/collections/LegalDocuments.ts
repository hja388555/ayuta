import type { CollectionConfig } from 'payload'
import { isActiveAdmin, isActiveSuper } from '../lib/admin-access'
import { recordLegalRevision } from './LegalRevisions'

/**
 * 이용약관·개인정보처리방침 원문(큐 Q25 2차). 고객용 /[locale]/terms · /[locale]/privacy 가 읽는다.
 * 종류+언어당 한 행. 행이 없으면 화면은 "준비 중"을 보여준다 — 받지 못한 문서를 지어내 채우지 않는다.
 * 수정은 최고관리자만. 지우지 않는다(동의 근거가 사라진다). 고칠 때마다 legal-revisions 에 남는다.
 */
export const LegalDocuments: CollectionConfig = {
  slug: 'legal-documents',
  admin: { useAsTitle: 'title' },
  access: {
    read: () => true,
    create: ({ req }) => isActiveSuper(req),
    update: ({ req }) => isActiveSuper(req),
    delete: () => false,
    unlock: () => false,
    admin: ({ req }) => isActiveAdmin(req),
  },
  hooks: { afterChange: [recordLegalRevision('legal-documents', (doc) => `${doc.kind === 'privacy' ? '개인정보처리방침' : '이용약관'} (${doc.locale})`)] },
  fields: [
    { name: 'kind', type: 'select', required: true, options: ['terms', 'privacy'], index: true },
    { name: 'locale', type: 'select', required: true, options: ['ko', 'ja'], index: true },
    { name: 'title', type: 'text', required: true },
    { name: 'body', type: 'textarea', required: true },
  ],
  indexes: [{ fields: ['kind', 'locale'], unique: true }],
}
