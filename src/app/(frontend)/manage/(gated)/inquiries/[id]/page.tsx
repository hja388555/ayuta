import Link from 'next/link'
import { notFound } from 'next/navigation'
import { AuthError, requireAdmin } from '@/lib/dal'
import { authedPayload } from '@/lib/admin/orders-data'
import { formatDateTime } from '@/lib/admin/format'
import { card } from '@/components/admin/styles'
import koMessages from '../../../../../../../messages/ko.json'
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
  const typeLabels = koMessages.categories as Record<string, string>
  // depth: 1 이라 관계가 펼쳐져 오지만, 타입상으로는 id(number)일 수도 있다 — 펼쳐진 것만 쓴다
  const files = (Array.isArray(doc.files) ? doc.files : []).flatMap((f) =>
    typeof f === 'object' && f !== null ? [{ id: f.id, originalName: f.originalName ?? null, filesize: f.filesize ?? null }] : [],
  )

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
        {row('유형', doc.type ? (typeLabels[doc.type as string] ?? '-') : '선택 안 함')}
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
    </main>
  )
}
