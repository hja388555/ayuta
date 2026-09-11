import type { Metadata } from 'next'
import { getPayload } from 'payload'
import config from '@payload-config'
import { getTranslations, setRequestLocale } from 'next-intl/server'
import { Shell } from '@/components/Shell'
import { LegalBody } from '@/components/LegalBody'
import { localeAlternates } from '@/lib/seo'
import s from './LegalDocumentView.module.css'

type Kind = 'terms' | 'privacy' | 'refund'
const PATH: Record<Kind, string> = { terms: '/terms', privacy: '/privacy', refund: '/refund' }
const TITLE: Record<Kind, 'termsTitle' | 'privacyTitle' | 'refundTitle'> = { terms: 'termsTitle', privacy: 'privacyTitle', refund: 'refundTitle' }

async function load(kind: Kind, locale: string) {
  const payload = await getPayload({ config })
  const { docs } = await payload.find({
    collection: 'legal-documents',
    where: { and: [{ kind: { equals: kind } }, { locale: { equals: locale === 'ja' ? 'ja' : 'ko' } }] },
    limit: 1,
    depth: 0,
    overrideAccess: true,
  })
  return docs[0] ?? null
}

export async function legalMetadata(kind: Kind, locale: string): Promise<Metadata> {
  const t = await getTranslations({ locale, namespace: 'legal' })
  return { title: t(TITLE[kind]), alternates: localeAlternates(locale, PATH[kind]) }
}

/** 개정일은 문서의 마지막 저장 시각(Asia/Seoul) — YYYY-MM-DD */
function ymd(iso: string) {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Seoul', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(iso))
}

/**
 * 이용약관·개인정보처리방침·환불 및 취소 정책 공개 화면(큐 Q25 2차, Figma [v2] 13-C·13-D).
 * 문구는 관리자(/manage/legal)가 고친 DB 값을 LegalBody 가 조항·표·안내 상자로 나눠 보여준다.
 * 아직 등록되지 않은 문서는 "준비 중"을 보여준다 — 받지 못한 원문을 지어내지 않는다.
 */
export async function LegalDocumentView({ kind, locale }: { kind: Kind; locale: string }) {
  setRequestLocale(locale)
  const t = await getTranslations('legal')
  const doc = await load(kind, locale)
  return (
    <main>
      <Shell as="section">
        <div data-legal-document={kind} className={s.wrap}>
          <h1 className={s.title}>{doc?.title ?? t(TITLE[kind])}</h1>
          {doc ? (
            <>
              <p className={s.revised}>{t('revised', { date: ymd(doc.updatedAt) })}</p>
              <LegalBody body={doc.body} toc={kind === 'privacy'} tocLabel={t('toc')} />
            </>
          ) : (
            <p className={s.revised}>{t('notReady')}</p>
          )}
        </div>
      </Shell>
    </main>
  )
}
