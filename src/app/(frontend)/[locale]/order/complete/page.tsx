import type { Metadata } from 'next'
import { cookies } from 'next/headers'
import { NO_INDEX } from '@/lib/seo'
import { getTranslations, setRequestLocale } from 'next-intl/server'
import { Shell } from '@/components/Shell'
import { CopyOrderNumber } from '@/components/CopyOrderNumber'
import { ContractModal } from '@/components/ContractModal'
import { findOwnedOrder, formatOrderSchedule } from '@/lib/order-lookup'
import { GUEST_PROOF_COOKIE_NAME, readGuestProof } from '@/lib/checkout/guest-proof'
import { getSessionUser } from '@/lib/dal'
import { sealDataUri } from '@/lib/seal'
import { categoryByNo } from '@/lib/categories'
import s from '@/components/OrderComplete.module.css'

export const dynamic = 'force-dynamic'
// 주문번호가 URL 에 실리는 개인 화면 — 검색에 올리지 않는다
export const metadata: Metadata = { robots: NO_INDEX }

type Props = {
  params: Promise<{ locale: string }>
  // email·phone은 더 이상 쿼리로 받지 않는다(I6) — /api/checkout이 남긴 서명된 쿠키에서
  // 읽는다. order만 URL에 남아도 된다: 번호를 안다고 남의 계약서가 열리지 않는다
  searchParams: Promise<{ order?: string }>
}

/**
 * 메일을 보내지 않기로 했으므로(2026-09-09 결정) 주문번호를 전달하는 유일한 경로다.
 * 번호만으로 남의 주문을 열지 않는다 — 회원이면 본인 주문인지, 비회원이면
 * 주문번호+이메일+연락처 세 값이 모두 맞는지 서버에서 확인한다.
 */
export default async function OrderCompletePage({ params, searchParams }: Props) {
  const { locale } = await params
  const { order: orderNumber } = await searchParams
  setRequestLocale(locale)

  const t = await getTranslations('orderComplete')
  const tCat = await getTranslations('categories')

  const sessionUser = await getSessionUser()
  const guestProof = !sessionUser && orderNumber ? readGuestProof((await cookies()).get(GUEST_PROOF_COOKIE_NAME)?.value, orderNumber) : null
  const order =
    orderNumber &&
    (sessionUser
      ? await findOwnedOrder(orderNumber, { kind: 'member', customerId: sessionUser.id })
      : guestProof && (await findOwnedOrder(orderNumber, { kind: 'guest', email: guestProof.email, phone: guestProof.phone })))

  if (!order) {
    return (
      <main>
        <Shell as="section">
          <div style={{ padding: '32px 0 64px' }}>
            <h1 style={{ fontSize: 'var(--fs-h1)' }}>{t('notFoundTitle')}</h1>
            <p style={{ marginTop: 12, color: 'var(--ink-500)' }}>{t('notFoundBody')}</p>
          </div>
        </Shell>
      </main>
    )
  }

  const schedule = formatOrderSchedule(order, t('schedulePending'))
  const sealSrc = await sealDataUri(order.sealAsset as number | null | undefined)

  const paid = order.status === 'paid'
  const isMember = Boolean(order.customer)
  const category = categoryByNo(order.category)
  const orderedAt = new Intl.DateTimeFormat('sv-SE', {
    timeZone: 'Asia/Seoul',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(new Date(order.createdAt))
  const amount = new Intl.NumberFormat(order.currency === 'KRW' ? 'ko-KR' : 'ja-JP', {
    style: 'currency',
    currency: order.currency,
    maximumFractionDigits: 0,
  }).format(order.amount)
  const nextSteps = [
    [t('next1Title'), t('next1Body')],
    [t('next2Title'), t('next2Body')],
    [t('next3Title'), t('next3Body')],
  ]

  return (
    <main>
      <Shell as="section">
        <div className={s.page}>
          {/* 결제는 제5조가 정한 계약 체결 요건이다("결제가 완료되면 계약이 체결된 것으로
              본다") — status가 paid가 되기 전까지는 아직 결제가 안 된 것이고, 이 화면과
              계약서 스냅샷 모두 "체결 완료"로 읽히면 안 된다(I7). 그래서 "결제 완료" 제목은
              paid 일 때만 쓰고, 그 전에는 "접수" 제목과 결제 대기 안내를 함께 보여준다 */}
          <div className={s.hero}>
            <div className={s.heroIcon}>
              <img src="/ui/check-lg.svg" alt="" width={36} height={36} />
            </div>
            <h1 className={s.heroTitle}>{paid ? t('paidTitle') : t('title')}</h1>
            <p className={s.heroText}>{isMember ? t('heroBody') : t('heroBodyGuest')}</p>
          </div>

          {!paid && <p className={s.pending}>{t('pendingNotice')}</p>}

          <section className={s.card} aria-labelledby="oc-info">
            <h2 id="oc-info" className={s.cardTitle}>
              {t('infoTitle')}
            </h2>
            {/* 계약기간·광고시작일은 계약서 스냅샷에 없다(결제 시점엔 미정) — 별도 컬럼을
                읽어 여기서 합성해 보여준다. 아직 안 정해졌으면 "협의 중" */}
            <dl className={s.table}>
              <div className={s.tableRow}>
                <dt>{t('orderNumberLabel')}</dt>
                <dd>
                  {order.orderNumber}
                  <CopyOrderNumber
                    orderNumber={order.orderNumber}
                    copyLabel={t('copyButton')}
                    copiedLabel={t('copied')}
                    className={`btn btn-secondary ${s.copyBtn}`}
                  />
                </dd>
              </div>
              <div className={s.tableRow}>
                <dt>{t('orderedAtLabel')}</dt>
                <dd>{orderedAt}</dd>
              </div>
              {category ? (
                <div className={s.tableRow}>
                  <dt>{t('serviceLabel')}</dt>
                  <dd>{`${category.no}. ${tCat(category.slug)}`}</dd>
                </div>
              ) : null}
              <div className={s.tableRow}>
                <dt>{t('payMethodLabel')}</dt>
                {/* 결제 수단은 PortOne 연동 후 실제 값으로 바뀐다. 지금은 카드 한 가지뿐이다 */}
                <dd>{paid ? t('payMethodCard') : t('payMethodPending')}</dd>
              </div>
              <div className={s.tableRow}>
                <dt>{t('amountLabel')}</dt>
                <dd>{amount}</dd>
              </div>
              <div className={s.tableRow}>
                <dt>{t('contractPeriodLabel')}</dt>
                <dd>{schedule.contractPeriod}</dd>
              </div>
              <div className={s.tableRow}>
                <dt>{t('adStartLabel')}</dt>
                <dd>{schedule.adStartDate}</dd>
              </div>
            </dl>
            {!isMember && <p className={s.guest}>{t('guestNotice')}</p>}
          </section>

          <section className={s.card} aria-labelledby="oc-next">
            <h2 id="oc-next" className={s.cardTitle}>
              {t('nextTitle')}
            </h2>
            <ol className={s.steps}>
              {nextSteps.map(([title, body], i) => (
                <li key={title}>
                  <span className={s.stepNum}>{i + 1}</span>
                  <div>
                    <strong>{title}</strong>
                    <span>{body}</span>
                  </div>
                </li>
              ))}
            </ol>
          </section>

          <div className={s.actions}>
            {/* 비회원은 마이페이지가 없다 — 주문번호 보관 안내(guestNotice)만 두고 버튼은 숨긴다 */}
            {isMember && (
              <a href={`/${locale}/mypage`} className={`btn btn-primary btn-lg ${s.primary}`}>
                <img src="/ui/chevron-right-white.svg" alt="" width={20} height={20} className="btn-icon" />
                {t('goMypage')}
              </a>
            )}
            {/* 계약서 보관함과 같은 팝업(Q21-B). 비회원은 주문 조회 인증 후 이 화면에서 본다 */}
            <div className={s.secondary}>
            <ContractModal
              buttonClassName="btn btn-outline btn-lg"
              buttonIcon="/ui/doc-20.svg"
              buttonLabel={t('viewContract')}
              closeLabel={t('close')}
              title={`${t('viewContract')} · ${order.orderNumber}`}
              facts={[
                { label: t('contractPeriodLabel'), value: schedule.contractPeriod },
                { label: t('adStartLabel'), value: schedule.adStartDate },
              ]}
              notice={order.status !== 'paid' ? t('contractPendingLabel') : undefined}
              contractText={order.contractText}
              seal={sealSrc ? { src: sealSrc, alt: t('sealAlt') } : undefined}
            />
            </div>
          </div>
        </div>
      </Shell>
    </main>
  )
}
