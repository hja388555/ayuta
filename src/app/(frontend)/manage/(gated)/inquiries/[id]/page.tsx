import type { ReactNode } from 'react'
import { notFound } from 'next/navigation'
import { AuthError, requireAdmin } from '@/lib/dal'
import { authedPayload } from '@/lib/admin/orders-data'
import { formatAmount, formatDateTime } from '@/lib/admin/format'
import { countryText, inquiryNumber, inquiryStatus } from '@/lib/admin/inquiry-display'
import { currencyForLocale } from '@/lib/payments/channel'
import { Badge } from '@/components/ui'
import { formatPhone } from '@/lib/phone'
import { QuoteIssueForm } from '@/components/admin/QuoteIssueForm'
import s from '../inquiries.module.css'

/** [v2] A9-B 문의 상세 + 견적 발행 */
type Props = { params: Promise<{ id: string }> }

export default async function InquiryDetailPage({ params }: Props) {
  try {
    await requireAdmin()
  } catch (err) {
    if (err instanceof AuthError) notFound()
    throw err
  }

  const id = Number((await params).id)
  if (!Number.isInteger(id) || id <= 0) notFound()

  const { payload, user } = await authedPayload()
  let doc
  try {
    doc = await payload.findByID({ collection: 'inquiries', id, depth: 1, user, overrideAccess: false })
  } catch {
    notFound()
  }
  // depth: 1 이라 관계가 펼쳐져 오지만, 타입상으로는 id(number)일 수도 있다 — 펼쳐진 것만 쓴다
  const files = (Array.isArray(doc.files) ? doc.files : []).flatMap((f) =>
    typeof f === 'object' && f !== null ? [{ id: f.id, originalName: f.originalName ?? null, filesize: f.filesize ?? null }] : [],
  )

  const { docs: quotes } = await payload.find({
    collection: 'quotes',
    where: { inquiry: { equals: id } },
    sort: '-issuedAt',
    limit: 50,
    depth: 0,
    user,
    overrideAccess: false,
  })
  const now = Date.now()
  const live = quotes.find((q) => q.status === 'issued' && new Date(q.expiresAt as string).getTime() > now)

  // 발행 이력: 견적 레코드에서 발행·회수·만료만 만든다(열람·결제 이벤트는 기록하지 않는다)
  const events = quotes
    .flatMap((q) => {
      const tag = `${q.quoteNumber as string} · ${formatAmount(q.total as number, q.currency as 'KRW' | 'JPY')}`
      const list: { at: string; text: string }[] = [{ at: q.issuedAt as string, text: `견적 발행 (${tag})` }]
      if (q.status === 'revoked' && q.revokedAt) list.push({ at: q.revokedAt as string, text: `견적 회수 (${q.quoteNumber as string})` })
      else if (q.status === 'issued' && new Date(q.expiresAt as string).getTime() <= now) list.push({ at: q.expiresAt as string, text: `유효기간 만료 (${q.quoteNumber as string})` })
      return list
    })
    .sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime())

  const st = inquiryStatus(doc.status)
  const row = (label: string, value: ReactNode) => (
    <div className={s.infoRow}>
      <span className={s.infoLabel}>{label}</span>
      <span className={s.infoValue}>{value}</span>
    </div>
  )

  const inquiryCard = (
    <section className={s.card}>
      <h2 className={s.cardTitle}>문의 내용</h2>
      <div className={s.info}>
        {row('접수일', formatDateTime(doc.createdAt as string))}
        {row('상태', <Badge tone={st.tone}>{st.label}</Badge>)}
        {row('고객', `${doc.name as string} · ${formatPhone(doc.phone as string)} · ${doc.email as string}`)}
        {row('회원', doc.customer ? '회원 문의' : '비회원 문의')}
        {row('국가', countryText(doc.country))}
        {row('언어', doc.locale === 'ja' ? '일본어' : '한국어')}
        {doc.type ? row('유형', doc.type as string) : null}
        {row('희망 지역', (doc.region as string) || '-')}
        {row('내용', doc.body as string)}
        {row(
          '첨부',
          files.length === 0 ? (
            '없음'
          ) : (
            <ul className={s.fileList}>
              {files.map((f) => (
                <li key={f.id}>
                  <a href={`/api/admin/inquiries/files/${f.id}`}>{f.originalName || `첨부 ${f.id}`}</a>
                  {typeof f.filesize === 'number' ? ` (${(f.filesize / 1024 / 1024).toFixed(1)}MB)` : null}
                </li>
              ))}
            </ul>
          ),
        )}
      </div>
    </section>
  )

  const history = (
    <section className={s.card}>
      <h2 className={s.cardTitle}>발행 이력</h2>
      {events.length === 0 ? <p className={s.muted}>아직 발행한 견적이 없습니다.</p> : null}
      {events.map((e, i) => (
        <div key={i} className={s.history}>
          <span className={s.historyAt}>{formatDateTime(e.at)}</span>
          <span className={s.historyText}>{e.text}</span>
        </div>
      ))}
      <p className={s.muted} style={{ fontSize: 12 }}>고객 열람·결제 이벤트는 아직 기록하지 않습니다.</p>
    </section>
  )

  return (
    <div className={s.page}>
      <div className={s.titleRow}>
        <h1 className={s.title}>견적 발행</h1>
        <Badge>{inquiryNumber(doc.id as number, doc.createdAt as string)}</Badge>
      </div>
      <QuoteIssueForm
        inquiryId={doc.id as number}
        currency={currencyForLocale(doc.locale === 'ja' ? 'ja' : 'ko')}
        hasLive={Boolean(live)}
        liveQuoteId={(live?.id as number | undefined) ?? null}
        inquiryCard={inquiryCard}
        history={history}
      />
    </div>
  )
}
