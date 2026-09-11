import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { getTranslations, setRequestLocale } from 'next-intl/server'
import { PasswordForm } from '@/components/MypageForms'
import { getSessionUser } from '@/lib/dal'
import s from '@/components/Account.module.css'

/** [v2] 09-E 비밀번호 변경. 본문만 — 사이드바·탭은 mypage/layout */
export const dynamic = 'force-dynamic'
export const metadata: Metadata = { robots: { index: false, follow: false } }

type Props = { params: Promise<{ locale: string }> }

export default async function PasswordPage({ params }: Props) {
  const { locale } = await params
  setRequestLocale(locale)
  const session = await getSessionUser()
  if (!session) redirect(`/${locale}/login?next=${encodeURIComponent(`/${locale}/mypage/password`)}`)

  const t = await getTranslations('account')
  return (
    <div className={s.page}>
      <h1 className={s.h1}>{t('password.title')}</h1>
      <PasswordForm locale={locale} labels={t.raw('password') as Record<string, string>} errors={t.raw('errors') as Record<string, string>} />
    </div>
  )
}
