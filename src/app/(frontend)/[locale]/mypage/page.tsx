import Link from 'next/link'
import { redirect } from 'next/navigation'
import { getTranslations, setRequestLocale } from 'next-intl/server'
import { getPayload } from 'payload'
import config from '@payload-config'
import { Badge } from '@/components/ui'
import { ContractModal } from '@/components/ContractModal'
import { getSessionUser } from '@/lib/dal'
import { categoryByNo } from '@/lib/categories'
import { formatOrderSchedule } from '@/lib/order-lookup'
import { createSealLoader } from '@/lib/seal'
import { isSigned, matchesFilter, statusTone, summarize, toSummaryFilter } from '@/lib/mypage/status'
import s from '@/components/Mypage.module.css'

/**
 * 주문 내역(Figma [v2] 09-A 215:2 / 215:117). 틀·메뉴·로그인 검사는 mypage/layout.tsx.
 * 본인 주문만: 세션 사용자 id 로만 조회한다. [계약서]는 체결된(결제 후) 주문에만 둔다.
 */
export const dynamic = 'force-dynamic'

type Props = { params: Promise<{ locale: string }>; searchParams: Promise<{ filter?: string }> }

export default async function MyOrdersPage({ params, searchParams }: Props) {
  const { locale } = await params
  const filter = toSummaryFilter((await searchParams).filter)
  setRequestLocale(locale)
  const session = await getSessionUser()
  if (!session) redirect(`/${locale}/login?next=${encodeURIComponent(`/${locale}/mypage`)}`)

  const t = await getTranslations('mypage')
  const tDetail = await getTranslations('mypage.detail')
  const tCat = await getTranslations('categories')
  const pending = (await getTranslations('contracts'))('schedulePending')
  const payload = await getPayload({ config })
  const { docs: orders } = await payload.find({
    collection: 'orders',
    where: { customer: { equals: session.id } },
    sort: '-createdAt',
    limit: 100,
    depth: 0,
    overrideAccess: true,
  })

  const loadSeal = createSealLoader()
  const seals = await Promise.all(orders.map((o) => (isSigned(o.status as string) ? loadSeal(o.sealAsset as number | null | undefined) : undefined)))

  const day = new Intl.DateTimeFormat('sv-SE', { timeZone: 'Asia/Seoul', year: 'numeric', month: '2-digit', day: '2-digit' })
  const money = (n: number, c: string) => new Intl.NumberFormat(c === 'JPY' ? 'ja-JP' : 'ko-KR', { style: 'currency', currency: c, maximumFractionDigits: 0 }).format(n)
  const counts = summarize(orders.map((o) => o.status as string))
  const stats = [
    ['all', t('summary.total'), counts.total],
    ['active', t('summary.active'), counts.active],
    ['done', t('summary.done'), counts.done],
    ['refund', t('summary.refund'), counts.refund],
  ] as const
  // 요약 카드를 누르면 그 묶음만 보인다. 요약 숫자는 필터와 상관없이 전체 기준이다
  const visible = orders.map((o, i) => ({ o, i })).filter(({ o }) => matchesFilter(o.status as string, filter))

  return (
    <>
      <h1 className={s.title}>{t('ordersTitle')}</h1>
      <nav className={s.summary} aria-label={t('summary.label')}>
        {stats.map(([key, label, n]) => (
          <Link
            key={key}
            href={key === 'all' ? `/${locale}/mypage` : `/${locale}/mypage?filter=${key}`}
            className={key === filter ? `${s.stat} ${s.statOn}` : s.stat}
            aria-current={key === filter ? 'true' : undefined}
            scroll={false}
          >
            <span>{label}</span>
            <strong>{t('summary.count', { n })}</strong>
          </Link>
        ))}
      </nav>

      {orders.length === 0 ? (
        <p className={s.empty}>{t('noOrders')}</p>
      ) : visible.length === 0 ? (
        <p className={s.empty}>{t('noOrdersFiltered')}</p>
      ) : (
        visible.map(({ o, i }) => {
          const status = o.status as string
          const category = categoryByNo(o.category as number)
          const orderNumber = o.orderNumber as string
          const schedule = formatOrderSchedule(o, pending)
          return (
            <article key={o.id} className={s.card}>
              <div className={s.cardHead}>
                <span className={s.orderNo}>{orderNumber}</span>
                <span className={s.badge}>
                  <Badge tone={statusTone(status)}>{t(`badge.${status}` as 'badge.paid')}</Badge>
                </span>
              </div>
              <h2 className={s.service}>{category ? `${category.no}. ${tCat(category.slug)}` : '-'}</h2>
              <div className={s.cardBody}>
                <div className={s.meta}>
                  <span>{t('list.orderedAt', { date: day.format(new Date(o.createdAt as string)) })}</span>
                  <span className={s.amount}>{money(o.amount as number, o.currency as string)}</span>
                </div>
                <div className={s.actions}>
                  <Link href={`/${locale}/mypage/orders/${encodeURIComponent(orderNumber)}`} className="btn btn-outline">
                    {t('list.detail')}
                  </Link>
                  {isSigned(status) ? (
                    <ContractModal
                      buttonClassName="btn btn-secondary"
                      buttonLabel={t('list.contract')}
                      closeLabel={tDetail('close')}
                      title={`${tDetail('contractTitle')} · ${orderNumber}`}
                      facts={[
                        { label: tDetail('contractPeriod'), value: schedule.contractPeriod },
                        { label: tDetail('adStartDate'), value: schedule.adStartDate },
                      ]}
                      notice={status === 'cancelled' ? tDetail('cancelledNotice') : undefined}
                      contractText={o.contractText as string}
                      seal={seals[i] ? { src: seals[i]!, alt: tDetail('sealAlt') } : undefined}
                    />
                  ) : null}
                </div>
              </div>
            </article>
          )
        })
      )}
    </>
  )
}
