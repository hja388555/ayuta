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
import { SIGNED_STATUSES } from '@/lib/mypage/status'
import s from '@/components/Mypage.module.css'

/**
 * 계약서 보관함(큐 Q21-B · Figma [v2] 09-G 215:460 / 215:557). 틀·메뉴는 mypage/layout.tsx.
 *
 * - 본인 주문만: 세션 사용자 id 로만 조회한다(URL·쿼리로 받은 id 를 쓰지 않는다 — 소유권 검증).
 * - "결제한" 계약서만: 결제 대기·결제 실패·확인 중 주문의 계약서는 아직 체결되지 않은 초안이다.
 *   결제 후 취소된 주문은 체결됐던 계약이라 상태와 함께 남긴다.
 * - 계약기간은 스냅샷에 없다(결제 시점엔 미정) — formatOrderSchedule 로 합쳐 보여주고,
 *   아직 안 정해졌으면 "기간 미정" 배지와 주황 글씨로 표시한다.
 */
export const dynamic = 'force-dynamic'

type Props = { params: Promise<{ locale: string }> }

export default async function ContractsPage({ params }: Props) {
  const { locale } = await params
  setRequestLocale(locale)
  const session = await getSessionUser()
  if (!session) redirect(`/${locale}/login?next=${encodeURIComponent(`/${locale}/mypage/contracts`)}`)

  const t = await getTranslations('contracts')
  const tCat = await getTranslations('categories')
  const payload = await getPayload({ config })
  const { docs: orders } = await payload.find({
    collection: 'orders',
    where: { and: [{ customer: { equals: session.id } }, { status: { in: [...SIGNED_STATUSES] } }] },
    sort: '-createdAt',
    limit: 200,
    depth: 0,
    overrideAccess: true,
  })

  // 주문마다 결제 시점 도장(없으면 undefined). 같은 도장은 한 번만 읽는다
  const loadSeal = createSealLoader()
  const seals = await Promise.all(orders.map((o) => loadSeal(o.sealAsset as number | null | undefined)))

  const day = new Intl.DateTimeFormat('sv-SE', { timeZone: 'Asia/Seoul', year: 'numeric', month: '2-digit', day: '2-digit' })

  return (
    <>
      <h1 className={s.title}>{t('title')}</h1>
      <p className={s.lead}>{t('intro')}</p>
      {orders.length === 0 ? (
        <p className={s.empty}>{t('empty')}</p>
      ) : (
        orders.map((o, i) => {
          const category = categoryByNo(o.category as number)
          const schedule = formatOrderSchedule(o, t('schedulePending'))
          const periodSet = Boolean(o.contractStart && o.contractEnd)
          const cancelled = o.status === 'cancelled'
          return (
            <article key={o.id} className={s.card}>
              <div className={s.cardHead}>
                <span className={s.orderNo}>{o.orderNumber as string}</span>
                <span className={s.badge}>
                  {cancelled ? (
                    <Badge>{t('cancelledBadge')}</Badge>
                  ) : periodSet ? (
                    <Badge tone="success">{t('signed')}</Badge>
                  ) : (
                    <Badge tone="warning">{t('periodPendingBadge')}</Badge>
                  )}
                </span>
              </div>
              <h2 className={s.service}>{category ? `${category.no}. ${tCat(category.slug)}` : '-'}</h2>
              <div className={s.cardBody}>
                <div className={s.meta}>
                  <span>{t('contractDateLine', { date: day.format(new Date(o.createdAt as string)) })}</span>
                  <span className={periodSet ? s.period : `${s.period} ${s.periodPending}`}>{t('periodLine', { period: schedule.contractPeriod })}</span>
                </div>
                <div className={s.viewBtn}>
                  <ContractModal
                    buttonClassName="btn btn-secondary"
                    buttonIcon="/ui/doc-18.svg"
                    buttonLabel={t('view')}
                    closeLabel={t('close')}
                    title={`${t('modalTitle')} · ${o.orderNumber as string}`}
                    facts={[
                      { label: t('contractPeriod'), value: schedule.contractPeriod },
                      { label: t('adStartDate'), value: schedule.adStartDate },
                    ]}
                    notice={cancelled ? t('cancelledNotice') : undefined}
                    contractText={o.contractText as string}
                    seal={seals[i] ? { src: seals[i]!, alt: t('sealAlt') } : undefined}
                  />
                </div>
              </div>
            </article>
          )
        })
      )}
      <ul className={s.notes}>
        <li>{t('note1')}</li>
        <li>{t('note2')}</li>
      </ul>
    </>
  )
}
