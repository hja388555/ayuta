import type { Metadata } from 'next'
import type { ReactNode } from 'react'
import { redirect } from 'next/navigation'
import { getTranslations, setRequestLocale } from 'next-intl/server'
import { getPayload } from 'payload'
import config from '@payload-config'
import { Shell } from '@/components/Shell'
import { MypageNav } from '@/components/MypageNav'
import { getSessionUser } from '@/lib/dal'
import s from '@/components/Mypage.module.css'

/**
 * 마이페이지 공통 틀(Figma [v2] 09 사이드바). 로그인하지 않았으면 로그인 화면으로 보낸다.
 * 레이아웃은 현재 경로를 모르므로 돌아올 곳은 마이페이지 첫 화면이다 — 하위 페이지가 정확한 경로로 다시 검사한다.
 */
export const dynamic = 'force-dynamic'
export const metadata: Metadata = { robots: { index: false, follow: false } }

export default async function MypageLayout({ children, params }: { children: ReactNode; params: Promise<{ locale: string }> }) {
  const { locale } = await params
  setRequestLocale(locale)
  const session = await getSessionUser()
  if (!session) redirect(`/${locale}/login?next=${encodeURIComponent(`/${locale}/mypage`)}`)

  const t = await getTranslations('mypage')
  const payload = await getPayload({ config })
  const me = await payload.findByID({ collection: 'users', id: session.id, depth: 0, overrideAccess: true })

  return (
    <main>
      <Shell as="section">
        <div className={s.layout}>
          <aside className={s.side}>
            <div className={s.user}>
              <span className={s.userName}>{t('greeting', { name: (me.name as string) ?? '' })}</span>
              <span className={s.userEmail}>{me.email as string}</span>
            </div>
            <MypageNav
              locale={locale}
              labels={{
                label: t('nav.label'),
                orders: t('nav.orders'),
                contracts: t('nav.contracts'),
                profile: t('nav.profile'),
                password: t('nav.password'),
                withdraw: t('nav.withdraw'),
                logout: t('nav.logout'),
              }}
            />
          </aside>
          <div className={s.main}>{children}</div>
        </div>
      </Shell>
    </main>
  )
}
