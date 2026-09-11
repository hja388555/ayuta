import type { Metadata } from 'next'
import { getPayload } from 'payload'
import config from '@payload-config'
import { getTranslations, setRequestLocale } from 'next-intl/server'
import { Shell } from '@/components/Shell'
import { localeAlternates } from '@/lib/seo'

type Kind = 'terms' | 'privacy'
const PATH: Record<Kind, string> = { terms: '/terms', privacy: '/privacy' }

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
  return { title: t(kind === 'terms' ? 'termsTitle' : 'privacyTitle'), alternates: localeAlternates(locale, PATH[kind]) }
}

/**
 * 이용약관·개인정보처리방침 공개 화면(큐 Q25 2차). 문구는 관리자(/manage/legal)가 고친 DB 값.
 * 아직 등록되지 않은 문서는 "준비 중"을 보여준다 — 받지 못한 원문을 지어내지 않는다.
 */
export async function LegalDocumentView({ kind, locale }: { kind: Kind; locale: string }) {
  setRequestLocale(locale)
  const t = await getTranslations('legal')
  const doc = await load(kind, locale)
  return (
    <main>
      <Shell as="section">
        <div data-legal-document={kind} style={{ padding: '32px 0 64px', maxWidth: 760 }}>
          <h1 style={{ fontSize: 'var(--fs-h1)' }}>{doc?.title ?? t(kind === 'terms' ? 'termsTitle' : 'privacyTitle')}</h1>
          {doc ? (
            <pre style={{ whiteSpace: 'pre-wrap', fontFamily: 'inherit', lineHeight: 1.7, marginTop: 24 }}>{doc.body}</pre>
          ) : (
            <p style={{ marginTop: 16, color: 'var(--ink-500)' }}>{t('notReady')}</p>
          )}
        </div>
      </Shell>
    </main>
  )
}
