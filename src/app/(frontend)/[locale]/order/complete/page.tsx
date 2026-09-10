import { getTranslations, setRequestLocale } from 'next-intl/server'
import { Shell } from '@/components/Shell'
import { CopyOrderNumber } from '@/components/CopyOrderNumber'
import { findOwnedOrder } from '@/lib/order-lookup'
import { getSessionUser } from '@/lib/dal'

export const dynamic = 'force-dynamic'

type Props = {
  params: Promise<{ locale: string }>
  searchParams: Promise<{ order?: string; email?: string; phone?: string }>
}

/**
 * 메일을 보내지 않기로 했으므로(2026-09-09 결정) 주문번호를 전달하는 유일한 경로다.
 * 번호만으로 남의 주문을 열지 않는다 — 회원이면 본인 주문인지, 비회원이면
 * 주문번호+이메일+연락처 세 값이 모두 맞는지 서버에서 확인한다.
 */
export default async function OrderCompletePage({ params, searchParams }: Props) {
  const { locale } = await params
  const { order: orderNumber, email, phone } = await searchParams
  setRequestLocale(locale)

  const t = await getTranslations('orderComplete')

  const sessionUser = await getSessionUser()
  const order =
    orderNumber &&
    (await findOwnedOrder(
      orderNumber,
      sessionUser ? { kind: 'member', customerId: sessionUser.id } : { kind: 'guest', email: email ?? '', phone: phone ?? '' },
    ))

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

          <details style={{ marginTop: 32 }}>
            <summary>{t('viewContract')}</summary>
            <pre style={{ whiteSpace: 'pre-wrap', fontFamily: 'inherit', marginTop: 12 }}>{order.contractText}</pre>
          </details>
        </div>
      </Shell>
    </main>
  )
}
