import type { CollectionAfterChangeHook, CollectionConfig } from 'payload'
import { isActiveAdmin } from '../lib/admin-access'

type Target = 'contract-templates' | 'legal-documents'

/**
 * 계약서·약관 수정 이력(큐 Q25 2차). 저장될 때마다 그 시점의 제목·본문 전체와 수정자를 남긴다.
 * 이미 체결된 계약은 주문의 contractText 스냅샷이 근거지만, 가입 동의(약관)는 스냅샷이 없다 —
 * "그 날짜에 어떤 약관이 걸려 있었나"는 이 기록으로만 답할 수 있다. 그래서 append-only.
 * 쓰기는 두 컬렉션의 afterChange 훅만 한다.
 */
export const LegalRevisions: CollectionConfig = {
  slug: 'legal-revisions',
  admin: { useAsTitle: 'label', defaultColumns: ['label', 'editorEmail', 'at'] },
  access: {
    create: () => false,
    read: ({ req }) => isActiveAdmin(req),
    update: () => false,
    delete: () => false,
    unlock: () => false,
    admin: ({ req }) => isActiveAdmin(req),
  },
  fields: [
    { name: 'target', type: 'select', required: true, options: ['contract-templates', 'legal-documents'], index: true },
    { name: 'docId', type: 'number', required: true, index: true },
    { name: 'label', type: 'text', required: true },
    { name: 'title', type: 'text', required: true },
    { name: 'body', type: 'textarea', required: true },
    // 계약서 동의 체크박스 문구(key·label·required). 약관 문서는 비어 있다
    { name: 'consents', type: 'json' },
    // 계정을 지워도 기록은 남는다(AdminLoginLogs 와 같은 이유) — 이메일 스냅샷을 같이 둔다.
    // 시드 스크립트처럼 사람 없이 바뀐 경우 둘 다 비고 editorEmail 은 'system'
    { name: 'editor', type: 'relationship', relationTo: 'users' },
    { name: 'editorEmail', type: 'text', required: true },
    { name: 'at', type: 'date', required: true, index: true },
  ],
}

/** 제목·본문·동의 문구가 실제로 바뀐 저장만 기록한다(active 토글 등은 문구 변경이 아니다) */
export function recordLegalRevision(target: Target, labelOf: (doc: Record<string, unknown>) => string): CollectionAfterChangeHook {
  return async ({ doc, previousDoc, operation, req }) => {
    const consentsOf = (d: Record<string, unknown> | undefined) =>
      Array.isArray(d?.consents) ? (d.consents as Array<{ key: string; label: string; required: boolean }>).map(({ key, label, required }) => ({ key, label, required })) : null
    const unchanged =
      operation === 'update' &&
      previousDoc?.title === doc.title &&
      previousDoc?.body === doc.body &&
      JSON.stringify(consentsOf(previousDoc)) === JSON.stringify(consentsOf(doc))
    if (unchanged) return doc
    const user = req.user as { id?: number; email?: string } | null | undefined
    await req.payload.create({
      collection: 'legal-revisions',
      data: {
        target,
        docId: doc.id,
        label: labelOf(doc),
        title: doc.title,
        body: doc.body,
        consents: consentsOf(doc),
        editor: user?.id ?? null,
        editorEmail: user?.email ?? 'system',
        at: new Date().toISOString(),
      },
      overrideAccess: true,
      req,
    })
    return doc
  }
}
