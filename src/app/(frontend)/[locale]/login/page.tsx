import type { Metadata } from 'next'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { getTranslations, setRequestLocale } from 'next-intl/server'
import { Shell } from '@/components/Shell'
import { LoginForm } from '@/components/LoginForm'
import { GuestLookupForm } from '@/components/GuestLookupForm'
import { getSessionUser } from '@/lib/dal'
import { isAdminRole } from '@/lib/roles'
import s from '@/components/Auth.module.css'

/**
 * 통합 로그인 화면(요구사항 1-16, Figma [v2] 08 · A0 관리자 진입) + 하단 비회원 주문 조회(126행).
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
  const common = { email: t('email'), emailPh: t('emailPh'), network: t('network') }

  return (
    <main>
      <Shell as="section">
        <div className={s.page}>
          <h1 className={s.h1}>{t('loginTitle')}</h1>
          <p className={s.sub}>{t('loginSub')}</p>
          <LoginForm
            locale={locale}
            next={next}
            labels={{
              ...common,
              password: t('password'),
              loginButton: t('loginButton'),
              loggingIn: t('loggingIn'),
              loginFailed: t('loginFailed'),
              keepLogin: t('keepLogin'),
              findPassword: t('findPassword'),
              findPasswordSoon: t('findPasswordSoon'),
              findPasswordChat: t('findPasswordChat'),
            }}
          />
          <div className={s.divider}>{t('or')}</div>
          <Link href={`/${locale}/signup`} className={`btn btn-outline btn-block ${s.outline}`}>
            {t('signupLink')}
          </Link>
          <GuestLookupForm
            locale={locale}
            labels={{
              ...common,
              title: t('guestTitle'),
              hint: t('guestHint'),
              orderNumber: t('orderNumber'),
              orderNumberPh: t('orderNumberPh'),
              phone: t('phone'),
              phonePh: t('phonePh'),
              lookupButton: t('lookupButton'),
              lookupFailed: t('lookupFailed'),
            }}
          />
        </div>
      </Shell>
    </main>
  )
}
