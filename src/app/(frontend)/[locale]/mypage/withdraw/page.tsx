import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { getTranslations, setRequestLocale } from 'next-intl/server'
import { getPayload } from 'payload'
import config from '@payload-config'
import { WithdrawForm } from '@/components/MypageForms'
import { ACTIVE_ORDER_STATUSES } from '@/app/(frontend)/api/me/withdraw/route'
import { CATEGORIES } from '@/lib/categories'
import { getSessionUser } from '@/lib/dal'
import s from '@/components/Account.module.css'

/**
 * [v2] 09-F 회원 탈퇴. 진행 중 주문(탈퇴 API 가 막는 것과 같은 상태 목록)을 미리 보여 주고 버튼을 막는다.
 * 본문만 — 사이드바·탭은 mypage/layout.
 */
export const dynamic = 'force-dynamic'
export const metadata: Metadata = { robots: { index: false, follow: false } }

type Props = { params: Promise<{ locale: string }> }

export default async function WithdrawPage({ params }: Props) {
  const { locale } = await params
  setRequestLocale(locale)
  const session = await getSessionUser()
  if (!session) redirect(`/${locale}/login?next=${encodeURIComponent(`/${locale}/mypage/withdraw`)}`)

  const t = await getTranslations('account')
  const tCat = await getTranslations('categories')
  const payload = await getPayload({ config })
  const { docs: active } = await payload.find({
    collection: 'orders',
    where: { and: [{ customer: { equals: session.id } }, { status: { in: [...ACTIVE_ORDER_STATUSES] } }] },
    sort: '-createdAt',
    limit: 20,
    depth: 0,
    overrideAccess: true,
  })
  const categoryLabel = (no: number) => {
    const slug = CATEGORIES.find((c) => c.no === no)?.slug
    return slug ? `${no}. ${tCat(slug)}` : ''
  }

  return (
    <div className={s.page}>
      <h1 className={s.h1}>{t('withdraw.title')}</h1>
      {active.length > 0 ? (
        <div className={s.warn} role="alert">
          <img src="/ui/alert.svg" alt="" width={24} height={24} />
          <div className={s.warnBody}>
            <p className={s.warnTitle}>{t('withdraw.blockedTitle', { count: active.length })}</p>
            <ul className={s.warnList}>
              {active.map((o) => (
                <li key={o.id}>
                  {[o.orderNumber as string, categoryLabel(o.category as number)].filter(Boolean).join(' · ')} — {t('withdraw.blockedSuffix')}
                </li>
              ))}
            </ul>
          </div>
        </div>
      ) : null}
      <WithdrawForm locale={locale} blocked={active.length > 0} labels={t.raw('withdraw') as Record<string, string>} errors={t.raw('errors') as Record<string, string>} />
    </div>
  )
}
