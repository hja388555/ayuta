import type { Metadata } from 'next'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { getTranslations, setRequestLocale } from 'next-intl/server'
import { getPayload } from 'payload'
import config from '@payload-config'
import { Shell } from '@/components/Shell'
import { ContractModal } from '@/components/ContractModal'
import { getSessionUser } from '@/lib/dal'
import { CATEGORIES } from '@/lib/categories'
import { formatOrderSchedule } from '@/lib/order-lookup'
import { createSealLoader } from '@/lib/seal'

/**
 * 계약서 보관함(큐 Q21-B). 결제한 모든 계약서를 목록으로 보여주고 [계약서 보기]로 스냅샷 전문을 띄운다.
 *
 * - 본인 주문만: 세션 사용자 id 로만 조회한다(URL·쿼리로 받은 id 를 쓰지 않는다 — 소유권 검증).
 * - "결제한" 계약서만: 결제 대기·결제 실패·확인 중 주문의 계약서는 아직 체결되지 않은 초안이다.
 *   결제 후 취소된 주문은 체결됐던 계약이라 상태와 함께 남긴다.
 * - 계약기간은 스냅샷에 없다(결제 시점엔 미정) — formatOrderSchedule 로 합쳐 보여준다.
 */
export const dynamic = 'force-dynamic'
export const metadata: Metadata = { robots: { index: false, follow: false } }

export const SIGNED_STATUSES = ['paid', 'in_progress', 'done', 'cancelled'] as const

type Props = { params: Promise<{ locale: string }> }

export default async function ContractsPage({ params }: Props) {
  const { locale } = await params
  setRequestLocale(locale)
  const session = await getSessionUser()
  if (!session) redirect(`/${locale}/login?next=${encodeURIComponent(`/${locale}/mypage/contracts`)}`)

  const t = await getTranslations('contracts')
  const tMy = await getTranslations('mypage')
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

  const dateFmt = new Intl.DateTimeFormat(locale === 'ja' ? 'ja-JP' : 'ko-KR', { timeZone: 'Asia/Seoul', year: 'numeric', month: '2-digit', day: '2-digit' })
  const statusLabels = tMy.raw('status') as Record<string, string>
  const slugFor = (no: number) => CATEGORIES.find((c) => c.no === no)?.slug
  const cell = { padding: '10px 8px', borderBottom: '1px solid var(--ink-100, #ECEEF1)', textAlign: 'left' as const, verticalAlign: 'top' as const }

  return (
    <main>
      <Shell as="section">
        <div style={{ padding: '32px 0 64px', maxWidth: 820, margin: '0 auto' }}>
          <p style={{ margin: '0 0 8px' }}>
            <Link href={`/${locale}/mypage`}>← {tMy('title')}</Link>
          </p>
          <h1 style={{ fontSize: 'var(--fs-h1)' }}>{t('title')}</h1>
          {orders.length === 0 ? (
            <p style={{ color: 'var(--ink-500)' }}>{t('empty')}</p>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr>
                    <th style={cell}>{t('orderNumber')}</th>
                    <th style={cell}>{t('service')}</th>
                    <th style={cell}>{t('contractDate')}</th>
                    <th style={cell}>{t('contractPeriod')}</th>
                    <th style={cell}>{t('status')}</th>
                    <th style={cell} />
                  </tr>
                </thead>
                <tbody>
                  {orders.map((o, i) => {
                    const slug = slugFor(o.category as number)
                    const schedule = formatOrderSchedule(o, t('schedulePending'))
                    return (
                      <tr key={o.id}>
                        <td style={cell}>{o.orderNumber as string}</td>
                        <td style={cell}>{slug ? tCat(slug) : '-'}</td>
                        <td style={cell}>{dateFmt.format(new Date(o.createdAt as string))}</td>
                        <td style={cell}>{schedule.contractPeriod}</td>
                        <td style={cell}>{statusLabels[o.status as string] ?? (o.status as string)}</td>
                        <td style={cell}>
                          <ContractModal
                            buttonLabel={t('view')}
                            closeLabel={t('close')}
                            title={`${t('modalTitle')} · ${o.orderNumber as string}`}
                            facts={[
                              { label: t('contractPeriod'), value: schedule.contractPeriod },
                              { label: t('adStartDate'), value: schedule.adStartDate },
                            ]}
                            notice={o.status === 'cancelled' ? t('cancelledNotice') : undefined}
                            contractText={o.contractText as string}
                            seal={seals[i] ? { src: seals[i]!, alt: t('sealAlt') } : undefined}
                          />
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
          <p style={{ marginTop: 24, color: 'var(--ink-500)', fontSize: 'var(--fs-sm)' }}>{t('footnote')}</p>
        </div>
      </Shell>
    </main>
  )
}
