import type { Metadata } from 'next'
import { getTranslations, setRequestLocale } from 'next-intl/server'
import { localeAlternates } from '@/lib/seo'
import { Shell } from '@/components/Shell'
import { CoverSteps } from '@/components/CoverSteps'
import { CATEGORIES } from '@/lib/categories'
import { COUNTRY_CODES, PURPOSE_CODES } from '@/lib/cover-selection'

type Props = { params: Promise<{ locale: string }> }

// canonical 자기참조 + ko/ja hreflang 상호참조(큐 Q27)
export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params
  return { alternates: localeAlternates(locale, '') }
}

// 표지는 상태가 없는 서버 컴포넌트다. v2 디자인(큐 Q32, Figma [v2] 205:2 / 207:2).
// 하단 문의 박스·푸터·모바일 탭바는 레이아웃이 모든 화면에 붙인다.
export default async function CoverPage({ params }: Props) {
  const { locale } = await params
  setRequestLocale(locale)
  const t = await getTranslations('cover')
  const tCat = await getTranslations('categories')

  return (
    <main>
      {/* 히어로 — 연파랑 배경과 글자만. 이미지는 넣지 않는다 (대표님 확정) */}
      <Shell as="section" bleed background="var(--surface-brand)">
        <div style={{ padding: '64px 0' }}>
          <span className="badge badge-brand" style={{ background: 'var(--brand-100)', color: 'var(--brand-900)' }}>
            {t('badge')}
          </span>
          <h1 style={{ fontSize: 'var(--fs-hero)', lineHeight: 1.3, margin: '14px 0 0', color: 'var(--ink-900)', maxWidth: '12em' }}>{t('title')}</h1>
          <p style={{ fontSize: 'var(--fs-body)', color: 'var(--ink-700)', margin: '16px 0 0' }}>{t('subtitle')}</p>
        </div>
      </Shell>

      <Shell as="section">
        <div style={{ padding: '64px 0 56px' }}>
          <CoverSteps
            locale={locale}
            categories={CATEGORIES}
            labels={{
              stepCountry: t('stepCountry'),
              stepCountryHint: t('stepCountryHint'),
              stepPurpose: t('stepPurpose'),
              stepService: t('stepService'),
              stepServiceHint: t('stepServiceHint'),
              countryRequired: t('countryRequired'),
              countries: Object.fromEntries(COUNTRY_CODES.map((c) => [c, t(`countries.${c}`)])) as Record<
                (typeof COUNTRY_CODES)[number],
                string
              >,
              purposes: Object.fromEntries(PURPOSE_CODES.map((p) => [p, t(`purposes.${p}`)])),
              categories: Object.fromEntries(CATEGORIES.map((c) => [c.slug, tCat(c.slug)])),
            }}
          />
        </div>
      </Shell>
    </main>
  )
}
