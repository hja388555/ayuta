import { NextIntlClientProvider } from 'next-intl'
import { setRequestLocale } from 'next-intl/server'
import { hasLocale } from 'next-intl'
import { notFound } from 'next/navigation'
import { routing } from '@/i18n/routing'

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

  return <NextIntlClientProvider>{children}</NextIntlClientProvider>
}
