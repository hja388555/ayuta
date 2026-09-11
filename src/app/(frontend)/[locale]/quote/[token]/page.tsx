import type { Metadata } from 'next'
import Link from 'next/link'
import { getTranslations, setRequestLocale } from 'next-intl/server'
import { getPayload } from 'payload'
import config from '@payload-config'
import { TotalBar } from '@/components/ui'
import { loadCompany } from '@/lib/company-settings'
import { hashQuoteToken, isQuoteTokenShape } from '@/lib/quotes/token'
import s from '@/components/InquiryQuote.module.css'

/**
 * 5번 견적서(요구사항 1-12 화면 11 · 11-B, v2 232:2 · 232:334). 로그인을 요구하지 않는다 — 토큰이 인증이다.
 *
 * - 토큰 원문은 DB 에 없다. 해시로 찾는다.
 * - 없는 토큰은 "유효하지 않은 링크" 하나로만 답한다(어떤 토큰이 있었는지 알려주지 않는다).
 *   만료·회수는 링크를 받은 사람만 볼 수 있으므로 견적번호와 상태를 보여준다.
 * - 검색 엔진·Referer 로 링크가 새지 않게 noindex · no-referrer.
 * - 결제는 PortOne 연동(도메인 연결 후) 전까지 막혀 있다. 주문자·동의 폼은 보이지만 제출되지 않는다.
 */
export const dynamic = 'force-dynamic'
export const metadata: Metadata = { robots: { index: false, follow: false }, referrer: 'no-referrer' }

type Props = { params: Promise<{ locale: string; token: string }> }

const DAY = 24 * 60 * 60 * 1000

export default async function QuotePage({ params }: Props) {
  const { locale, token } = await params
  setRequestLocale(locale)
  const t = await getTranslations('quote')
  const company = await loadCompany(locale === 'ja' ? 'ja' : 'ko')
  const payload = await getPayload({ config })

  let quote = null
  if (isQuoteTokenShape(token)) {
    const { docs } = await payload.find({
      collection: 'quotes',
      where: { tokenHash: { equals: hashQuoteToken(token) } },
      limit: 1,
      depth: 0,
      overrideAccess: true,
    })
    quote = docs[0] ?? null
  }

  const ymd = (d: string) => new Intl.DateTimeFormat('sv-SE', { timeZone: 'Asia/Seoul' }).format(new Date(d))
  const money = (n: number) =>
    new Intl.NumberFormat(locale === 'ja' ? 'ja-JP' : 'ko-KR', { style: 'currency', currency: (quote?.currency as string) || 'KRW' }).format(n)
  const tel = `tel:${company.phone.replace(/[^\d+]/g, '')}`

  // 11-B — 만료·회수·없는 링크 모두 같은 카드. 무엇 때문인지는 부제목과 상태 칸으로 구분한다
  const blocked = (reason: 'invalid' | 'expired' | 'revoked') => (
    <main className={s.blockedWrap}>
      <section className={s.blocked}>
        <div className={s.alertCircle}>
          <img src="/ui/alert.svg" alt="" width={34} height={34} />
        </div>
        <h1 className={s.blockedTitle}>{t('blockedTitle')}</h1>
        <p className={s.blockedSub}>
          <strong>{t(`${reason}Title`)}</strong>
          <br />
          {t(`${reason}Body`)}
        </p>
        {quote ? (
          <dl className={s.info}>
            <div className={s.infoRow}>
              <dt>{t('number')}</dt>
              <dd>{quote.quoteNumber as string}</dd>
            </div>
            <div className={s.infoRow}>
              <dt>{t('status')}</dt>
              <dd>{reason === 'revoked' ? t('statusRevoked') : t('statusExpired', { date: ymd(quote.expiresAt as string) })}</dd>
            </div>
          </dl>
        ) : null}
        <Link href={`/${locale}/order/other`} className={`btn btn-primary ${s.btnFull}`}>
          {t('requestAgain')}
        </Link>
        <a href={tel} className={`btn btn-outline ${s.btnFull}`}>
          <img src="/ui/phone.svg" alt="" className={s.phoneIcon} width={20} height={20} />
          {t('phoneLabel')} {company.phone}
        </a>
        <p className={s.blockedFoot}>· {t('blockedFoot')}</p>
      </section>
    </main>
  )

  if (!quote) return blocked('invalid')
  if (quote.status === 'revoked') return blocked('revoked')
  const left = Math.ceil((new Date(quote.expiresAt as string).getTime() - Date.now()) / DAY)
  if (left <= 0) return blocked('expired')

  // 주문자 정보는 문의 때 입력한 값으로 채운다. 고객이 고칠 수 있다(결제 연동 전이라 제출은 없다)
  const inquiryId = typeof quote.inquiry === 'object' && quote.inquiry ? quote.inquiry.id : quote.inquiry
  const inquiry = inquiryId
    ? await payload.findByID({ collection: 'inquiries', id: inquiryId as number, depth: 0, overrideAccess: true }).catch(() => null)
    : null

  const lines = (quote.lines ?? []) as Array<{ id?: string; label: string; quantity: number; unitAmount: number }>
  const total = money(quote.total as number)
  const until = ymd(quote.expiresAt as string)

  const agree = (text: string, href: string, view: string) => (
    <label className={s.check}>
      <input type="checkbox" disabled />
      <span className={s.checkBox} aria-hidden />
      <span className={s.checkText}>{text}</span>
      <a className={s.agreeBtn} href={href} target="_blank" rel="noopener noreferrer">
        <img src="/ui/doc.svg" alt="" width={16} height={16} />
        {view}
      </a>
    </label>
  )

  return (
    <main>
      <section className={s.band}>
        <span className={s.chip}>{t('chip')}</span>
        <h1 className={s.bandTitle}>{t('title')}</h1>
        <p className={s.bandSub}>{t('subtitle')}</p>
      </section>

      <div className={s.page}>
        <section className={s.card}>
          <h2 className={s.cardTitle}>{t('infoTitle')}</h2>
          <dl className={s.info}>
            <div className={s.infoRow}>
              <dt>{t('number')}</dt>
              <dd>{quote.quoteNumber as string}</dd>
            </div>
            <div className={s.infoRow}>
              <dt>{t('issuedAt')}</dt>
              <dd>{ymd(quote.issuedAt as string)}</dd>
            </div>
            <div className={s.infoRow}>
              <dt>{t('validUntil')}</dt>
              <dd>{t('validUntilValue', { date: until, days: left })}</dd>
            </div>
            <div className={s.infoRow}>
              <dt>{t('issuer')}</dt>
              <dd>
                {company.name} · {company.phone}
              </dd>
            </div>
          </dl>
        </section>

        <section className={s.card}>
          <h2 className={s.cardTitle}>{t('linesTitle')}</h2>
          <table className={s.table}>
            <thead>
              <tr>
                <th className={s.colItem}>{t('item')}</th>
                <th>{t('quantity')}</th>
                <th>{t('amount')}</th>
              </tr>
            </thead>
            <tbody>
              {lines.map((l, i) => (
                <tr key={l.id ?? i}>
                  <td>{l.label}</td>
                  <td className={s.num}>{l.quantity}</td>
                  <td className={s.num}>{money(l.quantity * l.unitAmount)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <TotalBar label={t('total')} amount={total} />
        </section>

        <section className={s.card}>
          <div className={s.cardHead}>
            <h2 className={s.cardTitle}>{t('ordererTitle')}</h2>
            <span className="badge">{t('ordererChip')}</span>
          </div>
          <p className={s.cardDesc}>{t('ordererDesc')}</p>
          <div className={s.cols3}>
            <label className={s.field}>
              <span className={s.label}>{t('ordererName')} *</span>
              <input className={s.input} name="name" defaultValue={(inquiry?.name as string) ?? ''} autoComplete="name" />
            </label>
            <label className={s.field}>
              <span className={s.label}>{t('ordererPhone')} *</span>
              <input className={s.input} name="phone" defaultValue={(inquiry?.phone as string) ?? ''} autoComplete="tel" inputMode="tel" />
            </label>
            <label className={s.field}>
              <span className={s.label}>{t('ordererEmail')} *</span>
              <input className={s.input} name="email" type="email" defaultValue={(inquiry?.email as string) ?? ''} autoComplete="email" />
            </label>
          </div>
          <div className={s.cols2}>
            <label className={s.field}>
              <span className={s.label}>{t('postalCode')} *</span>
              <input className={s.input} name="postalCode" placeholder="00000" autoComplete="postal-code" />
            </label>
            <label className={s.field}>
              <span className={s.label}>{t('address1')} *</span>
              <input className={s.input} name="address1" autoComplete="address-line1" />
            </label>
          </div>
          <label className={s.field}>
            <span className={s.label}>{t('address2')}</span>
            <input className={s.input} name="address2" placeholder={t('address2Placeholder')} autoComplete="address-line2" />
          </label>
        </section>

        <section className={s.card}>
          <h2 className={s.cardTitle}>{t('agreeTitle')}</h2>
          {agree(t('agreeTerms'), `/${locale}/terms`, t('view'))}
          {agree(t('agreePrivacy'), `/${locale}/privacy`, t('view'))}
          {agree(t('agreeContract'), `/${locale}/refund`, t('viewContract'))}
          <div className={`${s.check} ${s.sign}`}>
            <span className={s.checkBox} aria-hidden />
            <span className={s.checkText}>{t('signText')}</span>
            <span className={s.signName}>{(inquiry?.name as string) || '-'}</span>
          </div>
        </section>

        <section className={s.card}>
          <h2 className={s.cardTitle}>{t('payTitle')}</h2>
          <div className={s.method}>
            <span className={s.radioDot} aria-hidden />
            <img src="/ui/card.svg" alt="" className={s.methodIcon} width={20} height={20} />
            {t('payCard')}
          </div>
        </section>

        {/* PortOne 연동 전까지 비활성 */}
        <button type="button" disabled className={`btn btn-primary btn-block ${s.pay}`}>
          {t('payButton', { amount: total })}
        </button>
        <ul className={s.footNote}>
          <li>· {t('payNotice')}</li>
          <li>· {t('noteValid', { date: until })}</li>
          <li>· {t('noteUsed')}</li>
          <li>· {t('noteContact', { phone: company.phone })}</li>
        </ul>
      </div>
    </main>
  )
}
