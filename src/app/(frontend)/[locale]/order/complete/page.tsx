import { cookies } from 'next/headers'
import { getTranslations, setRequestLocale } from 'next-intl/server'
import { Shell } from '@/components/Shell'
import { CopyOrderNumber } from '@/components/CopyOrderNumber'
import { findOwnedOrder } from '@/lib/order-lookup'
import { GUEST_PROOF_COOKIE_NAME, readGuestProof } from '@/lib/checkout/guest-proof'
import { getSessionUser } from '@/lib/dal'

export const dynamic = 'force-dynamic'

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

          <details style={{ marginTop: 32 }}>
            <summary>{t('viewContract')}</summary>
            {order.status !== 'paid' && (
              <p style={{ marginTop: 12, color: 'var(--ink-500)', fontWeight: 600 }}>{t('contractPendingLabel')}</p>
            )}
            <pre style={{ whiteSpace: 'pre-wrap', fontFamily: 'inherit', marginTop: 12 }}>{order.contractText}</pre>
          </details>
        </div>
      </Shell>
    </main>
  )
}
