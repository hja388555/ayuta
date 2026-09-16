import type { Metadata } from 'next'
import { getTranslations, setRequestLocale } from 'next-intl/server'
import { localeAlternates } from '@/lib/seo'
import { Shell } from '@/components/Shell'
import { CoverSteps } from '@/components/CoverSteps'
import { CATEGORIES } from '@/lib/categories'
import { loadServices } from '@/lib/services/load'
import { COUNTRY_CODES, PURPOSE_CODES } from '@/lib/cover-selection'

type Props = { params: Promise<{ locale: string }> }

// canonical 자기참조 + ko/ja hreflang 상호참조(큐 Q27)
export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params
  return { alternates: localeAlternates(locale, '') }
}

// 표지 태그라인은 모바일에서만 "일본"/"日本" 앞에서 줄바꿈한다(5차 피드백 스케치 #20).
// 문자열 의미는 그대로 두고 표시 위치만 나눈다.
function splitTagline(tagline: string) {
  const marker = tagline.includes('일본') ? '일본' : '日本'
  const idx = tagline.indexOf(marker)
  if (idx <= 0) return { head: tagline, tail: '' }
  return { head: tagline.slice(0, idx), tail: tagline.slice(idx) }
}

// 표지는 상태가 없는 서버 컴포넌트다. v2 디자인(큐 Q32, Figma [v2] 205:2 / 207:2).
// 하단 문의 박스·푸터·모바일 탭바는 레이아웃이 모든 화면에 붙인다.
export default async function CoverPage({ params }: Props) {
  const { locale } = await params
  setRequestLocale(locale)
  const t = await getTranslations('cover')
  const tagline = t('tagline')
  const { head: taglineHead, tail: taglineTail } = splitTagline(tagline)

  // 메인 서비스 목록은 DB(ad-services)가 먼저다(2026-09-16). 이름도 DB 값을 쓰고, 아직 안 심겼으면
  // 기존 상수와 화면 문구로 떨어진다 — 전환 도중에도 목록이 비지 않게 한다
  const services = await loadServices()
  const coverCategories = services.length > 0 ? services.map((s) => ({ slug: s.slug })) : CATEGORIES
  const serviceNames =
    services.length > 0
      ? Object.fromEntries(services.map((s) => [s.slug, locale === 'ja' ? s.nameJa : s.nameKo]))
      : Object.fromEntries(CATEGORIES.map((c) => [c.slug, t(`services.${c.slug}`)]))

  return (
    <main>
      <Shell as="section">
        <div className="v3-body">
          <div className="cover-brand">
            <span className="cover-logo" aria-hidden>{t('logo')}</span>
            <div className="cover-text">
              <h1 className="cover-headline">{t('headline')}</h1>
              <p className="cover-tagline">
                {taglineTail ? (
                  <>
                    {taglineHead}
                    <br className="cover-tagline-break" />
                    {taglineTail}
                  </>
                ) : (
                  tagline
                )}
              </p>
            </div>
          </div>
        </div>
      </Shell>

      <Shell as="section">
        <div className="v3-body cover-body">
          <CoverSteps
            locale={locale}
            categories={coverCategories}
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
              services: serviceNames,
            }}
          />
        </div>
      </Shell>
    </main>
  )
}
