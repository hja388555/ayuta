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

// 표지는 상태가 없는 서버 컴포넌트다.
export default async function CoverPage({ params }: Props) {
  const { locale } = await params
  setRequestLocale(locale)
  const t = await getTranslations('cover')
  const tCat = await getTranslations('categories')
  const tInquiry = await getTranslations('inquiry')

  return (
    <main>
      {/* 히어로 — 배경색과 글자만. 이미지는 넣지 않는다 (대표님 확정) */}
      <Shell as="section" bleed background="var(--surface-brand)">
        <div style={{ padding: '64px 0' }}>
          <h1 style={{ fontSize: 'var(--fs-hero)', margin: 0, color: 'var(--brand-900)' }}>{t('title')}</h1>
          <p style={{ fontSize: 'var(--fs-body)', color: 'var(--ink-700)' }}>{t('subtitle')}</p>
        </div>
      </Shell>

      <Shell as="section">
        <div style={{ padding: '48px 0' }}>
          <CoverSteps
            locale={locale}
            categories={CATEGORIES}
            labels={{
              stepCountry: t('stepCountry'),
              stepCountryHint: t('stepCountryHint'),
              stepPurpose: t('stepPurpose'),
              stepService: t('stepService'),
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

      {/* 문의 안내는 본문 하단에 둔다 (플로팅 아님) */}
      <Shell as="footer" bleed background="var(--surface)">
        <div style={{ padding: '32px 0', color: 'var(--ink-500)', fontSize: 'var(--fs-sm)' }}>
          {tInquiry('notice')}
        </div>
      </Shell>
    </main>
  )
}
