import Link from 'next/link'
import { notFound } from 'next/navigation'
import { AuthError, requireAdmin } from '@/lib/dal'
import { authedPayload } from '@/lib/admin/orders-data'
import { formatAmount, formatDateTime } from '@/lib/admin/format'
import { currencyForLocale } from '@/lib/payments/channel'
import { card } from '@/components/admin/styles'
import { QuoteIssueForm, QuoteRevokeButton } from '@/components/admin/QuoteIssueForm'
import { INQUIRY_STATUS_LABELS } from '../page'

/** 5번 문의 상세. 견적 발행(Q14-B)이 이 화면에 붙는다 */
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
  const countryText = (c: unknown) => (Array.isArray(c) && c.length ? c.map((v) => (v === 'jp' ? '일본' : '한국')).join(' · ') : '-')
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

  const row = (label: string, value: React.ReactNode) => (
    <div style={{ display: 'flex', gap: 16, padding: '6px 0', fontSize: 14 }}>
      <div style={{ width: 90, color: '#767B85', flexShrink: 0 }}>{label}</div>
      <div style={{ whiteSpace: 'pre-wrap' }}>{value}</div>
    </div>
  )

  return (
    <main style={{ padding: 40, fontFamily: 'sans-serif', color: '#3D4046', maxWidth: 800 }}>
      <p style={{ margin: '0 0 8px' }}>
        <Link href="/manage/inquiries">← 문의 목록</Link>
      </p>
      <h1 style={{ fontSize: 20, marginBottom: 16 }}>문의 #{doc.id}</h1>
      <section style={card}>
        {row('접수', formatDateTime(doc.createdAt as string))}
        {row('상태', INQUIRY_STATUS_LABELS[doc.status as string] ?? (doc.status as string))}
        {row('국가', countryText(doc.country))}
        {row('언어', doc.locale === 'ja' ? '일본어' : '한국어')}
        {row('희망 지역', (doc.region as string) || '-')}
        {row('내용', doc.body as string)}
      </section>
      <section style={card}>
        <h2 style={{ fontSize: 15, margin: '0 0 8px' }}>연락처</h2>
        {row('이름', doc.name as string)}
        {row('연락처', doc.phone as string)}
        {row('이메일', doc.email as string)}
        {row('회원', doc.customer ? '회원 문의' : '비회원 문의')}
      </section>
      <section style={card}>
        <h2 style={{ fontSize: 15, margin: '0 0 8px' }}>첨부 파일</h2>
        {files.length === 0 ? (
          <p style={{ fontSize: 13, color: '#767B85', margin: 0 }}>없음</p>
        ) : (
          <ul style={{ margin: 0, paddingLeft: 18 }}>
            {files.map((f) => (
              <li key={f.id} style={{ fontSize: 14 }}>
                <a href={`/api/admin/inquiries/files/${f.id}`}>{f.originalName || `첨부 ${f.id}`}</a>
                {typeof f.filesize === 'number' ? <span style={{ color: '#767B85' }}> · {Math.ceil(f.filesize / 1024)}KB</span> : null}
              </li>
            ))}
          </ul>
        )}
      </section>
      <section style={card}>
        <h2 style={{ fontSize: 15, margin: '0 0 8px' }}>견적</h2>
        {quotes.length > 0 ? (
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13, marginBottom: 16 }}>
            <thead>
              <tr>
                <th style={{ textAlign: 'left', padding: 4 }}>견적번호</th>
                <th style={{ textAlign: 'right', padding: 4 }}>합계</th>
                <th style={{ textAlign: 'left', padding: 4 }}>상태</th>
                <th style={{ textAlign: 'left', padding: 4 }}>유효기간</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {quotes.map((q) => {
                const expired = new Date(q.expiresAt as string).getTime() <= Date.now()
                const state = q.status === 'revoked' ? '회수됨' : expired ? '만료' : '발행됨'
                return (
                  <tr key={q.id}>
                    <td style={{ padding: 4 }}>{q.quoteNumber as string}</td>
                    <td style={{ padding: 4, textAlign: 'right' }}>{formatAmount(q.total as number, q.currency as 'KRW' | 'JPY')}</td>
                    <td style={{ padding: 4 }}>{state}</td>
                    <td style={{ padding: 4 }}>{formatDateTime(q.expiresAt as string)}</td>
                    <td style={{ padding: 4 }}>{state === '발행됨' ? <QuoteRevokeButton quoteId={q.id as number} /> : null}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        ) : (
          <p style={{ fontSize: 13, color: '#767B85', margin: '0 0 12px' }}>아직 발행한 견적이 없습니다.</p>
        )}
        <QuoteIssueForm
          inquiryId={doc.id as number}
          currency={currencyForLocale(doc.locale === 'ja' ? 'ja' : 'ko')}
          hasLive={quotes.some((q) => q.status === 'issued' && new Date(q.expiresAt as string).getTime() > Date.now())}
        />
      </section>
    </main>
  )
}
