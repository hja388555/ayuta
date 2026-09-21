import type { Metadata } from 'next'
import { getTranslations, setRequestLocale } from 'next-intl/server'
import { Shell } from '@/components/Shell'
import { ForgotPasswordForm } from '@/components/PasswordResetForms'
import s from '@/components/Auth.module.css'

/** 비밀번호 찾기(큐 Q28). 이메일로 재설정 링크를 받는다 */
export const metadata: Metadata = { robots: { index: false, follow: false } }

const KEYS = ['email', 'emailPh', 'network', 'forgotButton', 'sending', 'forgotSent', 'backToLogin'] as const

export default async function ForgotPasswordPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params
  setRequestLocale(locale)
  const t = await getTranslations('auth')
  return (
    <main>
      <Shell as="section">
        <div className={s.page}>
          <h1 className={s.h1}>{t('forgotTitle')}</h1>
          <p className={s.sub}>{t('forgotSub')}</p>
          <ForgotPasswordForm locale={locale} labels={Object.fromEntries(KEYS.map((k) => [k, t(k)]))} />
        </div>
      </Shell>
    </main>
  )
}
