import type { Metadata } from 'next'
import Link from 'next/link'
import { getTranslations, setRequestLocale } from 'next-intl/server'
import { getPayload } from 'payload'
import config from '@payload-config'
import { Shell } from '@/components/Shell'
import { loadCompany } from '@/lib/company-settings'
import { hashQuoteToken, isQuoteTokenShape } from '@/lib/quotes/token'

/**
 * 5번 견적서(요구사항 1-12 화면 11 · 11-B). 로그인을 요구하지 않는다 — 토큰이 인증이다.
 *
 * - 토큰 원문은 DB 에 없다. 해시로 찾는다.
 * - 없는 토큰은 "유효하지 않은 링크" 하나로만 답한다(어떤 토큰이 있었는지 알려주지 않는다).
 *   만료·회수는 링크를 받은 사람만 볼 수 있으므로 견적번호와 상태를 보여준다.
 * - 검색 엔진·Referer 로 링크가 새지 않게 noindex · no-referrer.
 * - 결제 버튼은 PortOne 연동(도메인 연결 후) 전까지 비활성이다.
 */
export const dynamic = 'force-dynamic'
export const metadata: Metadata = { robots: { index: false, follow: false }, referrer: 'no-referrer' }

type Props = { params: Promise<{ locale: string; token: string }> }

export default async function QuotePage({ params }: Props) {
  const { locale, token } = await params
  setRequestLocale(locale)
  const t = await getTranslations('quote')
  const company = await loadCompany(locale === 'ja' ? 'ja' : 'ko')

  let quote = null
  if (isQuoteTokenShape(token)) {
    const payload = await getPayload({ config })
    const { docs } = await payload.find({
      collection: 'quotes',
      where: { tokenHash: { equals: hashQuoteToken(token) } },
      limit: 1,
      depth: 0,
      overrideAccess: true,
    })
    quote = docs[0] ?? null
  }

  const dateFmt = new Intl.DateTimeFormat(locale === 'ja' ? 'ja-JP' : 'ko-KR', { timeZone: 'Asia/Seoul', year: 'numeric', month: 'long', day: 'numeric' })
  const money = (n: number) =>
    new Intl.NumberFormat(locale === 'ja' ? 'ja-JP' : 'ko-KR', { style: 'currency', currency: (quote?.currency as string) || 'KRW' }).format(n)

  const notice = (title: string, body: string, number?: string) => (
    <main>
      <Shell as="section">
        <div style={{ padding: '48px 0 64px' }}>
          <h1 style={{ fontSize: 'var(--fs-h1)' }}>{title}</h1>
          {number ? (
            <p style={{ color: 'var(--ink-500)' }}>
              {t('number')}: {number}
            </p>
          ) : null}
          <p>{body}</p>
          <p style={{ marginTop: 24 }}>
            <Link href={`/${locale}/order/other?type=other`}>{t('requestAgain')}</Link>
          </p>
          <p style={{ color: 'var(--ink-500)' }}>
            {t('phoneLabel')}: {company.phone}
          </p>
        </div>
      </Shell>
    </main>
  )

  if (!quote) return notice(t('invalidTitle'), t('invalidBody'))
  if (quote.status === 'revoked') return notice(t('revokedTitle'), t('revokedBody'), quote.quoteNumber as string)
  if (new Date(quote.expiresAt as string).getTime() <= Date.now()) {
    return notice(t('expiredTitle'), t('expiredBody'), quote.quoteNumber as string)
  }

  const lines = (quote.lines ?? []) as Array<{ id?: string; label: string; quantity: number; unitAmount: number }>
  const cell = { padding: '10px 8px', borderBottom: '1px solid var(--ink-100, #ECEEF1)', textAlign: 'left' as const }

  return (
    <main>
      <Shell as="section">
        <div style={{ padding: '32px 0 64px' }}>
          <h1 style={{ fontSize: 'var(--fs-h1)' }}>{t('title')}</h1>
          <dl style={{ display: 'grid', gridTemplateColumns: 'auto 1fr', gap: '6px 16px', margin: '16px 0 24px' }}>
            <dt style={{ color: 'var(--ink-500)' }}>{t('number')}</dt>
            <dd style={{ margin: 0 }}>{quote.quoteNumber as string}</dd>
            <dt style={{ color: 'var(--ink-500)' }}>{t('issuedAt')}</dt>
            <dd style={{ margin: 0 }}>{dateFmt.format(new Date(quote.issuedAt as string))}</dd>
            <dt style={{ color: 'var(--ink-500)' }}>{t('validUntil')}</dt>
            <dd style={{ margin: 0 }}>{dateFmt.format(new Date(quote.expiresAt as string))}</dd>
            <dt style={{ color: 'var(--ink-500)' }}>{t('issuer')}</dt>
            <dd style={{ margin: 0 }}>
              {company.name} · {company.phone}
            </dd>
          </dl>

          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr>
                  <th style={cell}>{t('item')}</th>
                  <th style={{ ...cell, textAlign: 'right' }}>{t('quantity')}</th>
                  <th style={{ ...cell, textAlign: 'right' }}>{t('unitPrice')}</th>
                  <th style={{ ...cell, textAlign: 'right' }}>{t('amount')}</th>
                </tr>
              </thead>
              <tbody>
                {lines.map((l, i) => (
                  <tr key={l.id ?? i}>
                    <td style={cell}>{l.label}</td>
                    <td style={{ ...cell, textAlign: 'right' }}>{l.quantity}</td>
                    <td style={{ ...cell, textAlign: 'right' }}>{money(l.unitAmount)}</td>
                    <td style={{ ...cell, textAlign: 'right' }}>{money(l.quantity * l.unitAmount)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <p style={{ fontSize: 'var(--fs-h3, 20px)', textAlign: 'right', marginTop: 16 }}>
            {t('total')} <strong>{money(quote.total as number)}</strong>
          </p>

          <button type="button" disabled style={{ marginTop: 24, width: '100%', padding: '14px 0', fontSize: 'var(--fs-body)' }}>
            {t('payButton')}
          </button>
          <p style={{ color: 'var(--ink-500)', fontSize: 'var(--fs-sm)' }}>{t('payNotice')}</p>
        </div>
      </Shell>
    </main>
  )
}
