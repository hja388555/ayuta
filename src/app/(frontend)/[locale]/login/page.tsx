import type { Metadata } from 'next'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { getTranslations, setRequestLocale } from 'next-intl/server'
import { Shell } from '@/components/Shell'
import { LoginForm } from '@/components/LoginForm'
import { GuestLookupForm } from '@/components/GuestLookupForm'
import { getSessionUser } from '@/lib/dal'
import { isAdminRole } from '@/lib/roles'

/**
 * 통합 로그인 화면(요구사항 1-16) + 하단 비회원 주문 조회(126행).
 * 이미 로그인했으면 관리자는 관리자 홈, 고객은 마이페이지로 보낸다.
 */
export const dynamic = 'force-dynamic'
export const metadata: Metadata = { robots: { index: false, follow: false } }

type Props = { params: Promise<{ locale: string }>; searchParams: Promise<Record<string, string | string[] | undefined>> }

export default async function LoginPage({ params, searchParams }: Props) {
  const { locale } = await params
  setRequestLocale(locale)
  const user = await getSessionUser()
  if (user) redirect(isAdminRole(user.role) ? '/manage' : `/${locale}/mypage`)

  // 로그인 후 돌아갈 곳. 같은 사이트의 경로만 받는다 — 외부 주소로 보내는 오픈 리다이렉트를 막는다
  const sp = await searchParams
  const rawNext = typeof sp.next === 'string' ? sp.next : undefined
  const next = rawNext && rawNext.startsWith('/') && !rawNext.startsWith('//') ? rawNext : undefined

  const t = await getTranslations('auth')
  const common = { email: t('email'), network: t('network') }

  return (
    <main>
      <Shell as="section">
        <div style={{ padding: '32px 0 64px', maxWidth: 420, margin: '0 auto' }}>
          <h1 style={{ fontSize: 'var(--fs-h1)' }}>{t('loginTitle')}</h1>
          <LoginForm
            locale={locale}
            next={next}
            labels={{ ...common, password: t('password'), loginButton: t('loginButton'), loggingIn: t('loggingIn'), loginFailed: t('loginFailed') }}
          />
          <p style={{ marginTop: 16 }}>
            {t('noAccount')} <Link href={`/${locale}/signup`}>{t('signupLink')}</Link>
          </p>

          <section style={{ marginTop: 48, paddingTop: 24, borderTop: '1px solid var(--ink-100, #ECEEF1)' }}>
            <h2 style={{ fontSize: 'var(--fs-h3, 18px)' }}>{t('guestTitle')}</h2>
            <p style={{ color: 'var(--ink-500)' }}>{t('guestHint')}</p>
            <GuestLookupForm
              locale={locale}
              labels={{ ...common, orderNumber: t('orderNumber'), phone: t('phone'), lookupButton: t('lookupButton'), lookupFailed: t('lookupFailed') }}
            />
          </section>
        </div>
      </Shell>
    </main>
  )
}
