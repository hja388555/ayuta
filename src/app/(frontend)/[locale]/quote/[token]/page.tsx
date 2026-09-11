import type { Metadata } from 'next'
import Link from 'next/link'
import { getTranslations, setRequestLocale } from 'next-intl/server'
import { getPayload } from 'payload'
import config from '@payload-config'
import { fillContract, type Currency } from '@ayuta/pricing'
import { TotalBar } from '@/components/ui'
import { CheckoutForm } from '@/components/CheckoutForm'
import { loadCompany, loadCompanyContractFields } from '@/lib/company-settings'
import { CHECKOUT_LABEL_KEYS, type CheckoutLabels } from '@/lib/checkout/labels'
import type { ConsentDef } from '@/lib/checkout/consents'
import { loadActiveContractTemplate } from '@/lib/checkout/create-order'
import { QUOTE_CATEGORY, loadQuoteByToken } from '@/lib/quotes/create-quote-order'
import { parseQuoteLines } from '@/lib/quotes/lines'
import { quoteAccess, quoteOrderLines } from '@/lib/quotes/quote-order'
import s from '@/components/InquiryQuote.module.css'

/**
 * 5번 견적서(요구사항 1-12 화면 11 · 11-B, v2 232:2 · 232:334). 로그인을 요구하지 않는다 — 토큰이 인증이다.
 *
 * - 토큰 원문은 DB 에 없다. 해시로 찾는다.
 * - 없는 토큰은 "유효하지 않은 링크" 하나로만 답한다(어떤 토큰이 있었는지 알려주지 않는다).
 *   만료·회수는 링크를 받은 사람만 볼 수 있으므로 견적번호와 상태를 보여준다.
 * - 검색 엔진·Referer 로 링크가 새지 않게 noindex · no-referrer.
 * - 주문자·동의·서명·결제 버튼은 카테고리 결제와 같은 CheckoutForm 을 쓴다. 버튼은 /api/quote/order 로
 *   pending 주문을 만든다 — 실제 결제(PortOne)는 카테고리 결제와 마찬가지로 아직 붙지 않았다.
 */
export const dynamic = 'force-dynamic'
export const metadata: Metadata = { robots: { index: false, follow: false }, referrer: 'no-referrer' }

type Props = { params: Promise<{ locale: string; token: string }> }

const DAY = 24 * 60 * 60 * 1000

export default async function QuotePage({ params }: Props) {
  const { locale, token } = await params
  setRequestLocale(locale)
  const t = await getTranslations('quote')
  const contractLocale = locale === 'ja' ? 'ja' : 'ko'
  const company = await loadCompany(contractLocale)
  const payload = await getPayload({ config })

  const quote = await loadQuoteByToken(payload, token)

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
        {quote && reason !== 'invalid' ? (
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
  // 결제 API(createQuoteOrder)와 같은 판정을 쓴다 — 화면은 열리는데 결제만 거부되는 일이 없게
  const access = quoteAccess(quote)
  if (access !== 'ok') return blocked(access)
  // 금액의 근거라 화면에서도 라인을 다시 검증한다. 깨진 견적은 결제 API 도 거부한다
  const parsedLines = parseQuoteLines(quote.lines)
  if (!parsedLines.ok || parsedLines.total !== quote.total) return blocked('invalid')
  const left = Math.ceil((new Date(quote.expiresAt as string).getTime() - Date.now()) / DAY)

  // 주문자 정보는 문의 때 입력한 값으로 채운다. 고객이 고칠 수 있다
  const inquiryId = typeof quote.inquiry === 'object' && quote.inquiry ? quote.inquiry.id : quote.inquiry
  const inquiry = inquiryId
    ? await payload.findByID({ collection: 'inquiries', id: inquiryId as number, depth: 0, overrideAccess: true }).catch(() => null)
    : null

  const lines = (quote.lines ?? []) as Array<{ id?: string; label: string; quantity: number; unitAmount: number }>
  const total = money(quote.total as number)
  const until = ymd(quote.expiresAt as string)
  const currency = quote.currency as Currency

  // 계약서 미리보기 — 주문 생성(persistOrder)이 저장할 것과 같은 항목·금액으로 빈칸을 채운다.
  // 주문자 이름·서명은 아직 입력 전이라 비워 둔다(카테고리 결제 화면과 같다). 템플릿이 없으면 결제를 열지 않는다
  const template = await loadActiveContractTemplate(payload, QUOTE_CATEGORY, contractLocale)
  const orderLines = quoteOrderLines(
    { quoteNumber: quote.quoteNumber, lines: parsedLines.lines, total: parsedLines.total },
    Array.isArray(inquiry?.country) ? (inquiry.country as string[]) : [],
    contractLocale,
  )
  const preview = template
    ? fillContract(template.body as string, {
        amount: orderLines.amount,
        currency,
        contractDate: new Intl.DateTimeFormat('ko-KR', { timeZone: 'Asia/Seoul', year: 'numeric', month: 'long', day: 'numeric' }).format(new Date()),
        buyerName: '',
        signature: '',
        items: orderLines.contractItems,
        ...orderLines.contractFacts,
        ...(await loadCompanyContractFields(contractLocale)),
      })
    : null

  // 결제 폼 문구는 카테고리 결제(checkout)와 같다. 주문자 안내만 견적용(문의 때 입력한 값)으로 바꾼다
  const tc = await getTranslations('checkout')
  const labels = {
    ...(Object.fromEntries(CHECKOUT_LABEL_KEYS.map((k) => [k, tc.raw(k) as string])) as CheckoutLabels),
    ordererHint: t('ordererDesc'),
  }

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

        {template && preview ? (
          <CheckoutForm
            locale={locale}
            endpoint="/api/quote/order"
            // 금액·라인은 보내지 않는다 — 서버가 토큰으로 찾은 견적에서만 가져온다
            requestBody={{ token }}
            amount={orderLines.amount}
            currency={currency}
            template={{
              title: template.title as string,
              body: preview.text,
              consents: (template.consents as ConsentDef[] | undefined) ?? [],
            }}
            initialOrderer={{
              name: (inquiry?.name as string) ?? '',
              phone: (inquiry?.phone as string) ?? '',
              email: (inquiry?.email as string) ?? '',
            }}
            labels={labels}
            errorMessages={{
              already_ordered: t('errAlreadyOrdered'),
              quote_expired: t('errExpired'),
              quote_revoked: t('errRevoked'),
              invalid_quote: t('invalidTitle'),
            }}
          />
        ) : (
          <section className={s.card}>
            <h2 className={s.cardTitle}>{t('noContractTitle')}</h2>
            <p className={s.cardDesc}>{t('noContractBody')}</p>
            <a href={tel} className={`btn btn-outline ${s.btnFull}`}>
              <img src="/ui/phone.svg" alt="" className={s.phoneIcon} width={20} height={20} />
              {t('phoneLabel')} {company.phone}
            </a>
          </section>
        )}

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
