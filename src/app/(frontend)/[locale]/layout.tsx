import type { Metadata } from 'next'
import { NextIntlClientProvider } from 'next-intl'
import { getTranslations, setRequestLocale } from 'next-intl/server'
import { SiteHeader } from '@/components/SiteHeader'
import { SiteFooter } from '@/components/SiteFooter'
import { InstallBanner } from '@/components/InstallBanner'
import { loadFooterInfo } from '@/lib/company-settings'
import { getSessionUser } from '@/lib/dal'
import { isAdminRole } from '@/lib/roles'
import { hasLocale } from 'next-intl'
import { notFound } from 'next/navigation'
import { routing } from '@/i18n/routing'

// 헤더가 요청마다 로그인 상태·[관리자] 버튼을 판단해야 한다(요구사항 1-16). 정적으로 한 번
// 렌더링해 두면 모든 사람에게 같은 헤더(비로그인 상태)가 나간다
export const dynamic = 'force-dynamic'

// 로케일별 제목·설명(큐 Q27). 페이지가 따로 정하지 않으면 이 값이 쓰인다.
// canonical·hreflang 은 페이지마다 경로가 달라 각 페이지의 generateMetadata 가 정한다
export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params
  const t = await getTranslations({ locale, namespace: 'seo' })
  return {
    title: { default: t('title'), template: `%s | ${t('siteName')}` },
    description: t('description'),
    openGraph: { siteName: t('siteName'), locale: locale === 'ja' ? 'ja_JP' : 'ko_KR', type: 'website' },
  }
}

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }))
}

export default async function LocaleLayout({
  children,
  params,
}: {
  children: React.ReactNode
  params: Promise<{ locale: string }>
}) {
  const { locale } = await params
  // 목록에 없는 로케일이 URL 로 오면 404 — 상위 root layout 의 getLocale() 은
  // 이 경우와 무관하게 기본 로케일로 떨어지지만, 이 세그먼트 자체는 없는 페이지다
  if (!hasLocale(routing.locales, locale)) notFound()

  // 정적 렌더링(generateStaticParams)이 요청 로케일을 알 수 있도록 등록한다
  setRequestLocale(locale)

  // 헤더의 로그인 상태·[관리자] 버튼(요구사항 1-16). 버튼 노출은 편의일 뿐 권한 판정이 아니다
  const user = await getSessionUser()
  const t = await getTranslations('header')
  const tFooter = await getTranslations('footer')
  const tInstall = await getTranslations('install')

  return (
    <NextIntlClientProvider>
      <SiteHeader
        locale={locale}
        loggedIn={Boolean(user)}
        isAdmin={Boolean(user && isAdminRole(user.role))}
        labels={{ home: t('home'), inquiry: t('inquiry'), login: t('login'), signup: t('signup'), mypage: t('mypage'), logout: t('logout'), admin: t('admin') }}
      />
      {children}
      <InstallBanner labels={{ title: tInstall('title'), install: tInstall('install'), close: tInstall('close'), iosHint: tInstall('iosHint') }} />
      <SiteFooter
        info={await loadFooterInfo(locale === 'ja' ? 'ja' : 'ko')}
        labels={{ businessNo: tFooter('businessNo'), phone: tFooter('phone'), ceo: tFooter('ceo'), contact: tFooter('contact'), mailOrder: tFooter('mailOrder') }}
      />
    </NextIntlClientProvider>
  )
}
