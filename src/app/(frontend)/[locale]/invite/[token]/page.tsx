import type { Metadata } from 'next'
import Link from 'next/link'
import { getPayload } from 'payload'
import config from '@payload-config'
import { getTranslations, setRequestLocale } from 'next-intl/server'
import { Shell } from '@/components/Shell'
import { InviteForm, type InviteLabels } from '@/components/InviteForm'
import { findUsableInvite } from '@/lib/invites/service'
import s from '@/components/Auth.module.css'

/** 관리자 초대 수락. 토큰이 없거나·썼거나·만료됐으면 같은 안내 카드만 보여 준다 */
export const dynamic = 'force-dynamic'
export const metadata: Metadata = { robots: { index: false, follow: false }, referrer: 'no-referrer' }

type Props = { params: Promise<{ locale: string; token: string }> }

const KEYS = ['email', 'role', 'name', 'namePh', 'phone', 'phonePh', 'password', 'passwordHint', 'passwordConfirm', 'passwordConfirmPh', 'submit', 'submitting'] as const

export default async function InvitePage({ params }: Props) {
  const { locale, token } = await params
  setRequestLocale(locale)
  const t = await getTranslations('invite')
  const invite = await findUsableInvite(await getPayload({ config }), token)

  return (
    <main>
      <Shell as="section">
        <div className={s.page}>
          {invite ? (
            <>
              <h1 className={s.h1}>{t('title')}</h1>
              <p className={s.sub}>{t('sub')}</p>
              <InviteForm
                locale={locale}
                token={token}
                email={invite.email}
                roleLabel={t(`roles.${invite.role}`)}
                labels={{ ...(Object.fromEntries(KEYS.map((k) => [k, t(k)])) as Omit<InviteLabels, 'errors'>), errors: t.raw('errors') }}
              />
            </>
          ) : (
            <div className={s.card}>
              <h1 className={s.cardTitle}>{t('invalidTitle')}</h1>
              <p className={s.cardHint}>{t('invalidBody')}</p>
              <Link href={`/${locale}`} className={`btn btn-outline btn-block ${s.outline}`}>
                {t('home')}
              </Link>
            </div>
          )}
        </div>
      </Shell>
    </main>
  )
}
