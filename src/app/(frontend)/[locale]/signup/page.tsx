import type { Metadata } from 'next'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { getTranslations, setRequestLocale } from 'next-intl/server'
import { Shell } from '@/components/Shell'
import { SignupForm, type SignupLabels } from '@/components/SignupForm'
import { getSessionUser } from '@/lib/dal'
import s from '@/components/Auth.module.css'

/** 회원가입(Figma [v2] 08b). 이미 로그인했으면 마이페이지로 */
export const dynamic = 'force-dynamic'
export const metadata: Metadata = { robots: { index: false, follow: false } }

type Props = { params: Promise<{ locale: string }> }

const KEYS = [
  'accountTitle', 'ordererTitle', 'ordererHint', 'consentTitle',
  'email', 'emailPh', 'emailHelp', 'password', 'passwordHint', 'passwordConfirm', 'passwordConfirmPh',
  'name', 'namePh', 'phone', 'phonePh', 'postalCode', 'postalCodePh', 'address1', 'address1Ph', 'address2', 'address2Ph',
  'businessNo', 'businessNoPh', 'addressSearch',
  'agreeAll', 'agreeAge', 'agreeTerms', 'agreePrivacy', 'agreeMarketing', 'view', 'submit', 'submitting',
] as const

export default async function SignupPage({ params }: Props) {
  const { locale } = await params
  setRequestLocale(locale)
  if (await getSessionUser()) redirect(`/${locale}/mypage`)
  const t = await getTranslations('signup')
  const labels = Object.fromEntries(KEYS.map((k) => [k, t(k)])) as Omit<SignupLabels, 'errors'>

  return (
    <main>
      <Shell as="section">
        <div className={`${s.page} ${s.wide}`}>
          <h1 className={s.h1}>{t('title')}</h1>
          <p className={s.sub}>{t('sub')}</p>
          <p className={s.info}>{t('info')}</p>
          <SignupForm locale={locale} labels={{ ...labels, errors: t.raw('errors') }} />
          <p className={s.sub} style={{ fontSize: 15, textAlign: 'center' }}>
            {t('haveAccount')} <Link href={`/${locale}/login`}>{t('loginLink')}</Link>
          </p>
        </div>
      </Shell>
    </main>
  )
}
