import Link from 'next/link'
import { notFound } from 'next/navigation'
import { AuthError, requireAdmin } from '@/lib/dal'
import { isSuperRole } from '@/lib/roles'
import { findOrderForAdmin, findOrderNotes, findOrderTransitions } from '@/lib/admin/orders-data'
import { formatAmount, formatDateTime, toDateInputValue } from '@/lib/admin/format'
import { availableTransitions, statusLabel } from '@/lib/orders/transitions'
import { OrderNoteForm } from '@/components/admin/OrderNoteForm'
import { OrderScheduleForm } from '@/components/admin/OrderScheduleForm'
import { OrderStatusForm } from '@/components/admin/OrderStatusForm'
import { card, td, th } from '@/components/admin/styles'
import type { User } from '@/payload-types'

type Props = { params: Promise<{ id: string }> }

/** 관계 필드는 depth 에 따라 id 이거나 문서다. 사람이 읽을 이름만 뽑는다 */
function actorName(value: number | User | null | undefined): string {
  if (value == null) return '시스템'
  if (typeof value === 'number') return `#${value}`
  return value.email ?? `#${value.id}`
}

const row = (label: string, value: React.ReactNode) => (
  <tr>
    <th style={{ ...th, width: 140, background: 'transparent', borderBottom: '1px solid #ECEEF1' }}>{label}</th>
    <td style={td}>{value}</td>
  </tr>
)

export default async function OrderDetailPage({ params }: Props) {
  let user
  try {
    user = await requireAdmin()
  } catch (err) {
    if (err instanceof AuthError) notFound()
    throw err
  }

  // URL 세그먼트는 사용자 입력이다. 숫자가 아니면 조회를 시도하지 않는다 —
  // findByID 에 문자열을 넘기면 드라이버 예외가 나고 그게 500 으로 새 나간다
  const { id } = await params
  const orderId = Number(id)
  if (!Number.isInteger(orderId) || orderId <= 0) notFound()

  const order = await findOrderForAdmin(orderId)
  // 없는 주문과 권한 없는 주문을 구분해 알려주지 않는다 — 게이트 밖 접근과 같은 404
  if (!order) notFound()

  const [notes, transitions] = await Promise.all([findOrderNotes(orderId), findOrderTransitions(orderId)])
  const isSuper = isSuperRole(user.role)
  const options = availableTransitions(order.status, { isSuper }).map((value) => ({
    value,
    label: statusLabel(value),
  }))

  return (
    <main style={{ padding: 40, fontFamily: 'sans-serif', color: '#3D4046', maxWidth: 960 }}>
      <p style={{ fontSize: 13 }}>
        <Link href="/manage/orders" style={{ color: '#005AFA' }}>
          ← 주문 목록
        </Link>
      </p>
      <h1 style={{ fontSize: 20, marginBottom: 4 }}>{order.orderNumber}</h1>
      <p style={{ fontSize: 13, color: '#767B85', marginTop: 0 }}>
        현재 상태: {statusLabel(order.status)} · {user.email} ({user.role})
      </p>

      <section style={card}>
        <h2 style={{ fontSize: 15, marginTop: 0 }}>주문 요약</h2>
        <table style={{ borderCollapse: 'collapse', width: '100%' }}>
          <tbody>
            {row('금액', formatAmount(order.amount, order.currency))}
            {row('통화', order.currency)}
            {row('카테고리', `${order.category}번`)}
            {row('결제일', formatDateTime(order.paidAt))}
            {row('주문 생성', formatDateTime(order.createdAt))}
            {row('주문자', order.orderer?.name ?? '—')}
            {row('연락처', order.orderer?.phone ?? '—')}
            {row('이메일', order.orderer?.email ?? '—')}
            {row(
              '주소',
              [order.orderer?.postcode, order.orderer?.address1, order.orderer?.address2].filter(Boolean).join(' ') || '—',
            )}
            {row('사업자번호', order.orderer?.businessNo || '—')}
            {row(
              '선택 항목',
              <ul style={{ margin: 0, paddingLeft: 18 }}>
                {order.contractItems.map((item, i) => (
                  <li key={`${item.label}-${i}`}>
                    {item.label}: {item.value}
                  </li>
                ))}
              </ul>,
            )}
          </tbody>
        </table>
      </section>

      <section style={card}>
        <details>
          <summary style={{ cursor: 'pointer', fontSize: 15, fontWeight: 600 }}>계약서 전문 (읽기 전용)</summary>
          {/* 결제 시점 스냅샷이다. 화면에서도 코드에서도 절대 고치지 않는다 */}
          <pre
            style={{
              whiteSpace: 'pre-wrap',
              wordBreak: 'break-word',
              background: '#F7F7F7',
              padding: 12,
              borderRadius: 4,
              fontSize: 13,
              fontFamily: 'inherit',
              maxHeight: 400,
              overflow: 'auto',
            }}
          >
            {order.contractText}
          </pre>
        </details>
      </section>

      <section style={card}>
        <h2 style={{ fontSize: 15, marginTop: 0 }}>상태 변경</h2>
        <OrderStatusForm orderId={order.id} currentLabel={statusLabel(order.status)} options={options} />
        {!isSuper ? (
          <p style={{ fontSize: 12, color: '#767B85' }}>취소 처리는 super 권한만 할 수 있습니다.</p>
        ) : null}
      </section>

      <section style={card}>
        <h2 style={{ fontSize: 15, marginTop: 0 }}>계약기간 · 광고시작일</h2>
        <OrderScheduleForm
          orderId={order.id}
          initial={{
            contractStart: toDateInputValue(order.contractStart),
            contractEnd: toDateInputValue(order.contractEnd),
            adStartDate: toDateInputValue(order.adStartDate),
          }}
        />
      </section>

      <section style={card}>
        <h2 style={{ fontSize: 15, marginTop: 0 }}>연락메모</h2>
        <OrderNoteForm orderId={order.id} />
        <table style={{ borderCollapse: 'collapse', width: '100%', marginTop: 16 }}>
          <thead>
            <tr>
              <th style={th}>작성자</th>
              <th style={th}>시각</th>
              <th style={th}>내용</th>
            </tr>
          </thead>
          <tbody>
            {notes.length === 0 ? (
              <tr>
                <td style={td} colSpan={3}>
                  메모가 없습니다.
                </td>
              </tr>
            ) : (
              notes.map((note) => (
                <tr key={note.id}>
                  <td style={td}>{actorName(note.author)}</td>
                  <td style={td}>{formatDateTime(note.createdAt)}</td>
                  <td style={{ ...td, whiteSpace: 'pre-wrap' }}>{note.body}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </section>

      <section style={card}>
        <h2 style={{ fontSize: 15, marginTop: 0 }}>상태 변경 이력</h2>
        <table style={{ borderCollapse: 'collapse', width: '100%' }}>
          <thead>
            <tr>
              <th style={th}>시각</th>
              <th style={th}>변경</th>
              <th style={th}>처리자</th>
              <th style={th}>사유</th>
            </tr>
          </thead>
          <tbody>
            {transitions.length === 0 ? (
              <tr>
                <td style={td} colSpan={4}>
                  이력이 없습니다.
                </td>
              </tr>
            ) : (
              transitions.map((t) => (
                <tr key={t.id}>
                  <td style={td}>{formatDateTime(t.at)}</td>
                  <td style={td}>
                    {statusLabel(t.fromStatus)} → {statusLabel(t.toStatus)}
                  </td>
                  <td style={td}>{actorName(t.actor)}</td>
                  <td style={td}>{t.reason || '—'}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </section>
    </main>
  )
}
