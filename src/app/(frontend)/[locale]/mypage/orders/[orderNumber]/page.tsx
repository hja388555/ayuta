import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'
import { getTranslations, setRequestLocale } from 'next-intl/server'
import { Badge, TotalBar } from '@/components/ui'
import { ContractModal } from '@/components/ContractModal'
import { getSessionUser } from '@/lib/dal'
import { categoryByNo } from '@/lib/categories'
import { findOwnedOrder, formatOrderSchedule } from '@/lib/order-lookup'
import { sealDataUri } from '@/lib/seal'
import { loadPriceBook } from '@/lib/price-book'
import { contractItemDictionary, localizeContractItems } from '@/lib/mypage/localize-items'
import { PROGRESS_STEPS, isSigned, progressCount, statusTone } from '@/lib/mypage/status'
import s from '@/components/Mypage.module.css'

/**
 * 주문 상세(Figma [v2] 09-B 215:242 / 215:346). 회원 본인 주문만 연다 — 남의 주문번호는 없는 주문과 똑같이 404.
 * 환불 신청은 PortOne 연동 후 열린다. 그 전까지 버튼은 꺼 두고 1:1 문의로 안내한다.
 */
export const dynamic = 'force-dynamic'
export const metadata: Metadata = { robots: { index: false, follow: false } }

type Props = { params: Promise<{ locale: string; orderNumber: string }> }

export default async function OrderDetailPage({ params }: Props) {
  const { locale, orderNumber: raw } = await params
  setRequestLocale(locale)
  const orderNumber = decodeURIComponent(raw)
  const session = await getSessionUser()
  if (!session) redirect(`/${locale}/login?next=${encodeURIComponent(`/${locale}/mypage/orders/${raw}`)}`)

  const order = await findOwnedOrder(orderNumber, { kind: 'member', customerId: session.id })
  if (!order) notFound()

  const t = await getTranslations('mypage')
  const tCat = await getTranslations('categories')
  const pending = (await getTranslations('contracts'))('schedulePending')
  const schedule = formatOrderSchedule(order, pending)
  const sealSrc = isSigned(order.status) ? await sealDataUri(order.sealAsset as number | null | undefined) : undefined
  const category = categoryByNo(order.category)
  const on = progressCount(order.status)

  const orderedAt = new Intl.DateTimeFormat('sv-SE', {
    timeZone: 'Asia/Seoul',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(new Date(order.createdAt))
  const amount = new Intl.NumberFormat(order.currency === 'JPY' ? 'ja-JP' : 'ko-KR', { style: 'currency', currency: order.currency, maximumFractionDigits: 0 }).format(order.amount)

  // 3·4번은 contractItems 에 "광고 국가"가 이미 들어 있다. 없을 때만 주문의 국가 선택으로 채운다
  // 저장된 스냅샷은 주문 당시 언어(1번 라벨은 늘 한국어)라 보는 언어로 바꿔 보여 준다. 단가 이름은 두 통화의 단가표를 key 로 짝짓는다
  const viewLocale = locale === 'ja' ? 'ja' : 'ko'
  const orderLocale = order.locale === 'ja' ? 'ja' : 'ko'
  const [fromBook, toBook] = await Promise.all([loadPriceBook(order.category, order.currency), loadPriceBook(order.category, viewLocale === 'ja' ? 'JPY' : 'KRW')]).catch(() => [undefined, undefined])
  const dict = contractItemDictionary(orderLocale, viewLocale, { from: fromBook, to: toBook })
  const items = localizeContractItems(
    (order.contractItems ?? []).map((it) => ({ label: it.label, value: it.value })),
    dict,
  )
  const countryLabel = t('detail.country')
  const countries = ((order.country as string[] | null | undefined) ?? []).map((c) => t(`detail.countries.${c}` as 'detail.countries.kr'))
  const rows = [
    ...(category ? [{ label: t('detail.service'), value: `${category.no}. ${tCat(category.slug)}` }] : []),
    ...(countries.length > 0 && !items.some((it) => it.label === countryLabel || it.label === '광고 국가') ? [{ label: countryLabel, value: countries.join(', ') }] : []),
    ...items,
    { label: t('detail.contractPeriod'), value: schedule.contractPeriod },
    { label: t('detail.adStartDate'), value: schedule.adStartDate },
  ]

  return (
    <>
      <div className={s.titleRow}>
        <h1 className={s.title}>{t('detail.title')}</h1>
        <span className={s.badge}>
          <Badge tone={statusTone(order.status)}>{t(`badge.${order.status}` as 'badge.paid')}</Badge>
        </span>
      </div>
      <p className={s.sub}>{`${order.orderNumber} · ${orderedAt}`}</p>

      <section className={s.section} aria-labelledby="od-progress">
        <h2 id="od-progress" className={s.sectionTitle}>
          {t('detail.progressTitle')}
        </h2>
        <ol className={s.steps}>
          {PROGRESS_STEPS.map((step, i) => (
            <li key={step} className={i < on ? `${s.step} ${s.stepOn}` : s.step} aria-current={i === on - 1 ? 'step' : undefined}>
              {t(`detail.steps.${step}`)}
            </li>
          ))}
        </ol>
      </section>

      <section className={s.section} aria-labelledby="od-content">
        <h2 id="od-content" className={s.sectionTitle}>
          {t('detail.contentTitle')}
        </h2>
        <dl className={s.table}>
          {rows.map((r) => (
            <div key={r.label} className={s.row}>
              <dt>{r.label}</dt>
              <dd>{r.value}</dd>
            </div>
          ))}
        </dl>
        <div className={s.total}>
          <TotalBar label={t('detail.amount')} amount={amount} />
        </div>
      </section>

      <section className={s.section} aria-labelledby="od-contract">
        <h2 id="od-contract" className={s.sectionTitle}>
          {t('detail.contractTitle')}
        </h2>
        <p className={s.hint}>{t('detail.contractHint')}</p>
        <div className={s.wide}>
          <ContractModal
            buttonClassName="btn btn-secondary"
            buttonIcon="/ui/doc-20.svg"
            buttonLabel={t('detail.viewContract')}
            closeLabel={t('detail.close')}
            title={`${t('detail.contractTitle')} · ${order.orderNumber}`}
            facts={[
              { label: t('detail.contractPeriod'), value: schedule.contractPeriod },
              { label: t('detail.adStartDate'), value: schedule.adStartDate },
            ]}
            notice={order.status === 'cancelled' ? t('detail.cancelledNotice') : isSigned(order.status) ? undefined : t('detail.contractPending')}
            contractText={order.contractText}
            seal={sealSrc ? { src: sealSrc, alt: t('detail.sealAlt') } : undefined}
          />
        </div>
      </section>

      <section className={s.section} aria-labelledby="od-refund">
        <h2 id="od-refund" className={s.sectionTitle}>
          {t('detail.refundTitle')}
        </h2>
        <p className={s.hint}>{t('detail.refundHint')}</p>
        <div className={s.wide}>
          <button type="button" className="btn btn-outline" disabled aria-describedby="od-refund-soon">
            <img src="/ui/refund.svg" alt="" width={20} height={20} className="btn-icon" />
            {t('detail.refundButton')}
          </button>
        </div>
        <p id="od-refund-soon" className={s.linkRow}>
          <span>{t('detail.refundSoon')}</span>
          <Link href={`/${locale}/chat`}>{t('detail.inquiry')}</Link>
        </p>
      </section>
    </>
  )
}
