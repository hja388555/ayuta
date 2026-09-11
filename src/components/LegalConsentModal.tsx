'use client'

import { useEffect, useState } from 'react'
import { useTranslations } from 'next-intl'
import { Modal } from './ui'
import { LegalBody } from './LegalBody'
import s from './LegalConsentModal.module.css'

export type LegalKind = 'terms' | 'privacy' | 'refund'
type Doc = { title: string; body: string }
const TITLE: Record<LegalKind, 'termsTitle' | 'privacyTitle' | 'refundTitle'> = { terms: 'termsTitle', privacy: 'privacyTitle', refund: 'refundTitle' }
const AGREE: Record<LegalKind, 'agreeTerms' | 'agreePrivacy' | 'agreeRefund'> = { terms: 'agreeTerms', privacy: 'agreePrivacy', refund: 'agreeRefund' }

/**
 * 약관 동의 모달(Figma [v2] 13-A). 원문은 Payload REST(읽기 공개)에서 그때 가져온다 — 관리자가 고친 문구가 바로 보인다.
 * "동의하고 닫기"는 onAgree 로 해당 동의 칸을 켜게 한다. 문서가 아직 없으면 "준비 중"을 보인다.
 */
export function LegalConsentModal({ kind, locale, onClose, onAgree }: { kind: LegalKind | null; locale: string; onClose: () => void; onAgree: (kind: LegalKind) => void }) {
  const t = useTranslations('legal')
  const [docs, setDocs] = useState<Partial<Record<LegalKind, Doc | null | 'error'>>>({})
  const loc = locale === 'ja' ? 'ja' : 'ko'

  useEffect(() => {
    if (!kind || docs[kind] !== undefined) return
    let alive = true
    fetch(`/api/legal-documents?where[kind][equals]=${kind}&where[locale][equals]=${loc}&limit=1&depth=0`)
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
      .then((j: { docs?: Doc[] }) => alive && setDocs((d) => ({ ...d, [kind]: j.docs?.[0] ?? null })))
      .catch(() => alive && setDocs((d) => ({ ...d, [kind]: 'error' })))
    return () => {
      alive = false
    }
  }, [kind, loc, docs])

  const k = kind ?? 'terms'
  const doc = docs[k]
  const title = doc && doc !== 'error' ? doc.title : t(TITLE[k])

  return (
    <Modal
      open={kind !== null}
      onClose={onClose}
      title={title}
      subtitle={t('modalHint')}
      closeLabel={t('close')}
      className={s.wide}
      footer={
        <div className={s.foot}>
          <p className={s.agreeLine}>
            <span className={s.check} aria-hidden>
              <img src="/ui/legal-check.svg" alt="" width={14} height={14} />
            </span>
            {t(AGREE[k])}
          </p>
          <button
            type="button"
            className={`btn btn-primary btn-block ${s.agreeBtn}`}
            onClick={() => {
              onAgree(k)
              onClose()
            }}
          >
            {t('agreeAndClose')}
          </button>
        </div>
      }
    >
      {doc === undefined ? (
        <p className={s.muted}>{t('loading')}</p>
      ) : doc === 'error' ? (
        <p className={s.muted}>{t('loadFailed')}</p>
      ) : doc === null ? (
        <p className={s.muted}>{t('notReady')}</p>
      ) : (
        <LegalBody body={doc.body} variant="modal" />
      )}
    </Modal>
  )
}
