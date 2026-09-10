import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'
import { AuthError, OtpRequiredError, requireAdminVerified } from '@/lib/dal'
import { findOrdersForAdmin } from '@/lib/admin/orders-data'
import { buildOrderListQuery, orderListHref, parseOrderListParams } from '@/lib/admin/order-list-query'
import { formatAmount, formatDateTime } from '@/lib/admin/format'
import { STATUS_LABELS, statusLabel } from '@/lib/orders/transitions'
import { ORDER_STATUSES } from '@/collections/Orders'
import { card, td, th } from '@/components/admin/styles'

/**
 * 주문 목록.
 *
 * (gated) 레이아웃이 이미 게이트를 걸지만 여기서도 requireAdminVerified() 를 부른다 —
 * 레이아웃 하나에만 의존하면 나중에 이 페이지가 다른 곳으로 옮겨졌을 때 조용히 열린다.
 * 실패 처리도 기존 /manage 화면과 같다: OTP 미완료는 verify 로, 그 외 인증 실패는 404,
 * 진짜 장애는 그대로 올려보내 500 으로 드러낸다.
 */
type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> }

export default async function OrdersPage({ searchParams }: Props) {
  try {
    await requireAdminVerified()
  } catch (err) {
    if (err instanceof OtpRequiredError) redirect('/manage/verify')
    if (err instanceof AuthError) notFound()
    throw err
  }

  const params = parseOrderListParams(await searchParams)
  const result = await findOrdersForAdmin(buildOrderListQuery(params))

  return (
    <main style={{ padding: 40, fontFamily: 'sans-serif', color: '#3D4046' }}>
      <h1 style={{ fontSize: 20, marginBottom: 16 }}>주문 목록</h1>

      <form method="get" style={{ ...card, display: 'flex', gap: 8, alignItems: 'flex-end', flexWrap: 'wrap' }}>
        <div>
          <label style={{ fontSize: 12, color: '#767B85', display: 'block', marginBottom: 4 }} htmlFor="status">
            상태
          </label>
          <select
            id="status"
            name="status"
            defaultValue={params.status ?? ''}
            style={{ padding: '6px 8px', border: '1px solid #D6D9DE', borderRadius: 4, fontSize: 13 }}
          >
            <option value="">전체</option>
            {ORDER_STATUSES.map((s) => (
              <option key={s} value={s}>
                {STATUS_LABELS[s]}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label style={{ fontSize: 12, color: '#767B85', display: 'block', marginBottom: 4 }} htmlFor="q">
            주문번호 검색
          </label>
          <input
            id="q"
            name="q"
            defaultValue={params.q}
            placeholder="AY-..."
            style={{ padding: '6px 8px', border: '1px solid #D6D9DE', borderRadius: 4, fontSize: 13, width: 220 }}
          />
        </div>
        <button
          type="submit"
          style={{
            padding: '6px 14px',
            border: '1px solid #005AFA',
            background: '#005AFA',
            color: '#fff',
            borderRadius: 4,
            fontSize: 13,
            cursor: 'pointer',
          }}
        >
          조회
        </button>
        <Link href="/manage/orders" style={{ fontSize: 13, color: '#767B85' }}>
          초기화
        </Link>
      </form>

      <p style={{ fontSize: 13, color: '#767B85' }}>
        전체 {result.totalDocs}건 · {result.page}/{result.totalPages || 1} 페이지
      </p>

      <table style={{ borderCollapse: 'collapse', width: '100%', marginTop: 8 }}>
        <thead>
          <tr>
            <th style={th}>주문번호</th>
            <th style={th}>상태</th>
            <th style={th}>금액</th>
            <th style={th}>카테고리</th>
            <th style={th}>주문자</th>
            <th style={th}>결제일</th>
          </tr>
        </thead>
        <tbody>
          {result.docs.length === 0 ? (
            <tr>
              <td style={td} colSpan={6}>
                조건에 맞는 주문이 없습니다.
              </td>
            </tr>
          ) : (
            result.docs.map((order) => (
              <tr key={order.id}>
                <td style={td}>
                  <Link href={`/manage/orders/${order.id}`} style={{ color: '#005AFA' }}>
                    {order.orderNumber}
                  </Link>
                </td>
                <td style={td}>{statusLabel(order.status)}</td>
                <td style={td}>{formatAmount(order.amount, order.currency)}</td>
                <td style={td}>{order.category}번</td>
                <td style={td}>{order.orderer?.name ?? '—'}</td>
                <td style={td}>{formatDateTime(order.paidAt)}</td>
              </tr>
            ))
          )}
        </tbody>
      </table>

      <nav style={{ marginTop: 16, display: 'flex', gap: 12, fontSize: 13 }}>
        {result.page > 1 ? <Link href={orderListHref(params, result.page - 1)}>← 이전</Link> : <span style={{ color: '#A3A8B0' }}>← 이전</span>}
        {result.page < result.totalPages ? (
          <Link href={orderListHref(params, result.page + 1)}>다음 →</Link>
        ) : (
          <span style={{ color: '#A3A8B0' }}>다음 →</span>
        )}
      </nav>
    </main>
  )
}
