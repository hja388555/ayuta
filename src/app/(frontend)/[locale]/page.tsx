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

  return (
    <main>
      <Shell as="section">
        <div className="cover-brand">
          <span className="cover-logo" aria-hidden>{t('logo')}</span>
          <h1 className="cover-headline">{t('headline')}</h1>
        </div>
        <p className="cover-tagline">{t('tagline')}</p>
      </Shell>

      <Shell as="section">
        <div className="v3-body" style={{ padding: '48px 0 56px' }}>
          <CoverSteps
            locale={locale}
            categories={CATEGORIES}
            labels={{
              stepCountry: t('stepCountry'),
              stepPurpose: t('stepPurpose'),
              stepService: t('stepService'),
              countryRequired: t('countryRequired'),
              countries: Object.fromEntries(COUNTRY_CODES.map((c) => [c, t(`countries.${c}`)])) as Record<
                (typeof COUNTRY_CODES)[number],
                string
              >,
              countryNotes: Object.fromEntries(
                COUNTRY_CODES.filter((c) => t.has(`countryNotes.${c}`)).map((c) => [c, t(`countryNotes.${c}`)]),
              ),
              purposes: Object.fromEntries(PURPOSE_CODES.map((p) => [p, t(`purposes.${p}`)])),
              services: Object.fromEntries(CATEGORIES.map((c) => [c.slug, t(`services.${c.slug}`)])),
            }}
          />
        </div>
      </Shell>
    </main>
  )
}
