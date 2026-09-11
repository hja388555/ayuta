import Link from 'next/link'
import { notFound } from 'next/navigation'
import { AuthError, requireAdmin } from '@/lib/dal'
import { authedPayload } from '@/lib/admin/orders-data'
import { formatDateTime } from '@/lib/admin/format'
import { card, td, th } from '@/components/admin/styles'

/** 5번 문의 목록. 최신순. 견적 발행(Q14-B)은 상세 화면에서 이어진다 */
export const INQUIRY_STATUS_LABELS: Record<string, string> = { new: '새 문의', quoted: '견적 발행', closed: '종료' }

export default async function InquiriesPage() {
  try {
    await requireAdmin()
  } catch (err) {
    if (err instanceof AuthError) notFound()
    throw err
  }

  const { payload, user } = await authedPayload()
  const { docs } = await payload.find({
    collection: 'inquiries',
    sort: '-createdAt',
    limit: 200,
    depth: 0,
    user,
    overrideAccess: false,
  })
  const countryText = (c: unknown) => (Array.isArray(c) && c.length ? c.map((v) => (v === 'jp' ? '일본' : '한국')).join(' · ') : '-')

  return (
    <main style={{ padding: 40, fontFamily: 'sans-serif', color: '#3D4046' }}>
      <p style={{ margin: '0 0 8px' }}>
        <Link href="/manage">← 관리자 홈</Link>
      </p>
      <h1 style={{ fontSize: 20, marginBottom: 16 }}>문의 목록</h1>
      <section style={card}>
        <table style={{ borderCollapse: 'collapse', width: '100%' }}>
          <thead>
            <tr>
              <th style={th}>접수</th>
              <th style={th}>국가</th>
              <th style={th}>이름</th>
              <th style={th}>연락처</th>
              <th style={th}>첨부</th>
              <th style={th}>상태</th>
            </tr>
          </thead>
          <tbody>
            {docs.map((d) => (
              <tr key={d.id}>
                <td style={td}>
                  <Link href={`/manage/inquiries/${d.id}`}>{formatDateTime(d.createdAt as string)}</Link>
                </td>
                <td style={td}>{countryText(d.country)}</td>
                <td style={td}>{d.name as string}</td>
                <td style={td}>
                  {d.phone as string}
                  <div style={{ fontSize: 12, color: '#767B85' }}>{d.email as string}</div>
                </td>
                <td style={td}>{Array.isArray(d.files) ? d.files.length : 0}</td>
                <td style={td}>{INQUIRY_STATUS_LABELS[d.status as string] ?? (d.status as string)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {docs.length === 0 ? <p style={{ fontSize: 13, color: '#767B85' }}>접수된 문의가 없습니다.</p> : null}
      </section>
    </main>
  )
}
