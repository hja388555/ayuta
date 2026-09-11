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

  return (
    <main>
      <Shell as="section">
        <div style={{ padding: '32px 0 64px' }}>
          <h1 style={{ fontSize: 'var(--fs-h1)' }}>{t('title')}</h1>

          <div style={{ marginTop: 24 }}>
            <span style={{ color: 'var(--ink-500)' }}>{t('orderNumberLabel')}</span>
            <div style={{ display: 'flex', alignItems: 'center', marginTop: 4 }}>
              <strong style={{ fontSize: 'var(--fs-h1)' }}>{order.orderNumber}</strong>
              <CopyOrderNumber orderNumber={order.orderNumber} copyLabel={t('copyButton')} copiedLabel={t('copied')} />
            </div>
          </div>

          {/* 계약기간·광고시작일은 계약서 스냅샷에 없다(결제 시점엔 미정) — 별도 컬럼을
              읽어 여기서 합성해 보여준다. 아직 안 정해졌으면 "협의 중" */}
          <dl style={{ marginTop: 24, display: 'grid', gridTemplateColumns: 'auto 1fr', gap: '8px 16px' }}>
            <dt style={{ color: 'var(--ink-500)' }}>{t('contractPeriodLabel')}</dt>
            <dd style={{ margin: 0 }}>{schedule.contractPeriod}</dd>
            <dt style={{ color: 'var(--ink-500)' }}>{t('adStartLabel')}</dt>
            <dd style={{ margin: 0 }}>{schedule.adStartDate}</dd>
          </dl>

          {!order.customer && (
            <p style={{ marginTop: 16, color: 'var(--ink-500)' }}>{t('guestNotice')}</p>
          )}

          {/* 결제는 제5조가 정한 계약 체결 요건이다("결제가 완료되면 계약이 체결된 것으로
              본다") — status가 paid가 되기 전까지는 아직 결제가 안 된 것이고, 이 화면과
              계약서 스냅샷 모두 "체결 완료"로 읽히면 안 된다(I7). admin 쪽은 이미
              status/paidAt을 그대로 보여줘서 맞다 — 여기 고객 화면 문구만 고친다 */}
          {order.status !== 'paid' && (
            <p style={{ marginTop: 16, padding: '12px 16px', border: '1px solid var(--line-strong)', borderRadius: 8, fontWeight: 600 }}>
              {t('pendingNotice')}
            </p>
          )}

          {/* 계약서 보관함과 같은 팝업(Q21-B). 비회원은 주문 조회 인증 후 이 화면에서 본다 */}
          <div style={{ marginTop: 32 }}>
            <ContractModal
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
      </Shell>
    </main>
  )
}
