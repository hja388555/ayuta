import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { getTranslations, setRequestLocale } from 'next-intl/server'
import { getPayload } from 'payload'
import config from '@payload-config'
import { ProfileForm } from '@/components/MypageForms'
import { getSessionUser } from '@/lib/dal'
import s from '@/components/Account.module.css'

/** [v2] 09-D 회원정보 수정. 사이드바·탭은 mypage/layout 이 그린다 — 여기는 본문만 */
export const dynamic = 'force-dynamic'
export const metadata: Metadata = { robots: { index: false, follow: false } }

type Props = { params: Promise<{ locale: string }> }

export default async function ProfilePage({ params }: Props) {
  const { locale } = await params
  setRequestLocale(locale)
  // 레이아웃 가드와 별개로 페이지에서도 확인한다 — 레이아웃만으로는 직접 렌더를 보장하지 못한다
  const session = await getSessionUser()
  if (!session) redirect(`/${locale}/login?next=${encodeURIComponent(`/${locale}/mypage/profile`)}`)

  const t = await getTranslations('account')
  const payload = await getPayload({ config })
  const me = await payload.findByID({ collection: 'users', id: session.id, depth: 0, overrideAccess: true })
  const str = (v: unknown) => (typeof v === 'string' ? v : '')

  return (
    <div className={s.page}>
      <h1 className={s.h1}>{t('profile.title')}</h1>
      <ProfileForm
        email={session.email}
        initial={{
          name: str(me.name),
          phone: str(me.phone),
          postalCode: str(me.postalCode),
          address1: str(me.address1),
          address2: str(me.address2),
          businessNo: str(me.businessNo),
        }}
        labels={t.raw('profile') as Record<string, string>}
        errors={t.raw('errors') as Record<string, string>}
      />
    </div>
  )
}
