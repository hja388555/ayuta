import type { Metadata } from 'next'
import { getTranslations, setRequestLocale } from 'next-intl/server'
import { Shell } from '@/components/Shell'
import { ResetPasswordForm } from '@/components/PasswordResetForms'
import s from '@/components/Auth.module.css'

/** 새 비밀번호 설정(큐 Q28). 재설정 메일의 링크(?token=)로 들어온다 */
export const dynamic = 'force-dynamic'
// 주소에 토큰이 들어 있다 — 검색에 걸리거나 다른 사이트로 Referer 가 새지 않게
export const metadata: Metadata = { robots: { index: false, follow: false }, referrer: 'no-referrer' }

const KEYS = [
  'network', 'sending', 'backToLogin', 'newPassword', 'newPasswordPh', 'confirmPassword', 'confirmPasswordPh',
  'resetButton', 'resetDone', 'resetWeak', 'resetMismatch', 'resetInvalid', 'resetNoToken', 'forgotAgain',
  'showPassword', 'hidePassword',
] as const

type Props = { params: Promise<{ locale: string }>; searchParams: Promise<Record<string, string | string[] | undefined>> }

export default async function ResetPasswordPage({ params, searchParams }: Props) {
  const { locale } = await params
  setRequestLocale(locale)
  const sp = await searchParams
  const token = typeof sp.token === 'string' ? sp.token : ''
  const t = await getTranslations('auth')
  return (
    <main>
      <Shell as="section">
        <div className={s.page}>
          <h1 className={s.h1}>{t('resetTitle')}</h1>
          <p className={s.sub}>{t('resetSub')}</p>
          <ResetPasswordForm locale={locale} token={token} labels={Object.fromEntries(KEYS.map((k) => [k, t(k)]))} />
        </div>
      </Shell>
    </main>
  )
}
