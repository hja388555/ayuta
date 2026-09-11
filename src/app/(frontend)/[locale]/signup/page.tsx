import type { Metadata } from 'next'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { getTranslations, setRequestLocale } from 'next-intl/server'
import { Shell } from '@/components/Shell'
import { SignupForm } from '@/components/SignupForm'
import { getSessionUser } from '@/lib/dal'

/** 회원가입. 이미 로그인했으면 마이페이지로 */
export const dynamic = 'force-dynamic'
export const metadata: Metadata = { robots: { index: false, follow: false } }

type Props = { params: Promise<{ locale: string }> }

export default async function SignupPage({ params }: Props) {
  const { locale } = await params
  setRequestLocale(locale)
  if (await getSessionUser()) redirect(`/${locale}/mypage`)
  const t = await getTranslations('signup')

  return (
    <main>
      <Shell as="section">
        <div style={{ padding: '32px 0 64px', maxWidth: 420, margin: '0 auto' }}>
          <h1 style={{ fontSize: 'var(--fs-h1)' }}>{t('title')}</h1>
          <SignupForm
            locale={locale}
            labels={{
              email: t('email'),
              password: t('password'),
              passwordHint: t('passwordHint'),
              name: t('name'),
              phone: t('phone'),
              postalCode: t('postalCode'),
              address1: t('address1'),
              address2: t('address2'),
              agreeTerms: t('agreeTerms'),
              agreePrivacy: t('agreePrivacy'),
              view: t('view'),
              submit: t('submit'),
              submitting: t('submitting'),
              errors: t.raw('errors'),
            }}
          />
          <p style={{ marginTop: 16 }}>
            {t('haveAccount')} <Link href={`/${locale}/login`}>{t('loginLink')}</Link>
          </p>
        </div>
      </Shell>
    </main>
  )
}
