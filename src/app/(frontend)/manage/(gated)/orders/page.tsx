import Link from 'next/link'
import { notFound } from 'next/navigation'
import { AuthError, requireAdmin } from '@/lib/dal'
import { countOrdersByStatus, findOrdersForAdmin, resolvePhoneOrderIds } from '@/lib/admin/orders-data'
import {
  buildOrderListQuery,
  buildOrderWhere,
  ORDER_PERIODS,
  orderDetailHref,
  orderExportHref,
  orderListHref,
  orderStatusHref,
  pageWindow,
  parseOrderListParams,
  PERIOD_LABELS,
} from '@/lib/admin/order-list-query'
import { formatAmount } from '@/lib/admin/format'
import { adminStatusTone, categoryLabel, formatMonthDay } from '@/lib/admin/order-display'
import { STATUS_LABELS, statusLabel } from '@/lib/orders/transitions'
import { ORDER_STATUSES } from '@/collections/Orders'
import { Badge } from '@/components/ui'
import s from '@/components/admin/AdminOrders.module.css'

/**
 * 주문 · 접수 관리(Figma [v2] A3 228:334 PC · 228:533 Mobile). 바깥 셸은 (gated) 레이아웃이 그린다.
 *
 * (gated) 레이아웃이 이미 게이트를 걸지만 여기서도 requireAdmin() 를 부른다 —
 * 레이아웃 하나에만 의존하면 나중에 이 페이지가 다른 곳으로 옮겨졌을 때 조용히 열린다.
 * 인증 실패는 404, 진짜 장애는 그대로 올려보내 500 으로 드러낸다.
 */
type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> }

export default async function OrdersPage({ searchParams }: Props) {
  try {
    await requireAdmin()
  } catch (err) {
    if (err instanceof AuthError) notFound()
    throw err
  }

  const params = parseOrderListParams(await searchParams)
  const now = new Date()
  const phoneOrderIds = await resolvePhoneOrderIds(params.q)
  const [result, counts] = await Promise.all([
    findOrdersForAdmin(buildOrderListQuery(params, now, phoneOrderIds)),
    countOrdersByStatus(buildOrderWhere(params, { includeStatus: false, now, phoneOrderIds }), ORDER_STATUSES),
  ])
  const totalPages = Math.max(1, result.totalPages)
  // ?page=999 처럼 마지막 페이지를 넘긴 주소 — 빈 표 대신 마지막 페이지로 가는 길을 준다
  const pastLast = result.docs.length === 0 && result.totalDocs > 0 && params.page > totalPages
  // 상세의 "목록으로"가 지금 필터·페이지로 돌아오게 한다
  const listHref = orderListHref(params, params.page)
  const emptyText = pastLast ? (
    <>
      {params.page}페이지에는 주문이 없습니다. <Link href={orderListHref(params, totalPages)}>마지막 페이지로</Link>
    </>
  ) : (
    '조건에 맞는 주문이 없습니다.'
  )

  const chip = (key: string, label: string, count: number, active: boolean, href: string) => (
    <li key={key}>
      <Link href={href} className={`${s.chip} ${active ? s.chipActive : ''}`} aria-current={active ? 'page' : undefined}>
        {label}
        <span>{count}</span>
      </Link>
    </li>
  )

  return (
    <div className={s.page}>
      <div className={s.head}>
        <h1 className={s.title}>주문 · 접수 관리</h1>
        <a href={orderExportHref(params)} className={s.outlineBtn} download>
          내보내기
        </a>
      </div>

      <ul className={s.chips} aria-label="상태별 보기">
        {chip('all', '전체', counts.total, params.status === null, orderStatusHref(params, null))}
        {ORDER_STATUSES.map((st) =>
          chip(st, STATUS_LABELS[st], counts.byStatus[st] ?? 0, params.status === st, orderStatusHref(params, st)),
        )}
      </ul>

      <form method="get" className={s.filters} role="search">
        <label className={s.search}>
          <img src="/ui/admin-search.svg" alt="" width={18} height={18} />
          <input name="q" defaultValue={params.q} placeholder="주문번호 · 고객명 · 연락처로 검색" aria-label="검색어" maxLength={50} />
        </label>
        <div className={s.selects}>
          <select name="status" defaultValue={params.status ?? ''} className={s.select} aria-label="상태">
            <option value="">상태 전체</option>
            {ORDER_STATUSES.map((st) => (
              <option key={st} value={st}>
                {STATUS_LABELS[st]}
              </option>
            ))}
          </select>
          <select name="period" defaultValue={params.period} className={s.select} aria-label="기간">
            {ORDER_PERIODS.map((p) => (
              <option key={p} value={p}>
                {PERIOD_LABELS[p]}
              </option>
            ))}
          </select>
          <button type="submit" className={s.submit}>
            조회
          </button>
        </div>
      </form>

      <section className={s.card} aria-label={`주문 ${result.totalDocs}건`}>
        <div className={`${s.tableWrap} ${s.listTable}`}>
          <table className={s.table}>
            <thead>
              <tr>
                <th>주문번호</th>
                <th>주문일</th>
                <th>고객</th>
                <th>서비스</th>
                <th>금액</th>
                <th>상태</th>
                <th>
                  <span style={{ position: 'absolute', width: 1, height: 1, overflow: 'hidden', clip: 'rect(0 0 0 0)' }}>상세</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {result.docs.length === 0 ? (
                <tr>
                  <td colSpan={7} className={s.empty}>
                    {emptyText}
                  </td>
                </tr>
              ) : (
                result.docs.map((order) => (
                  <tr key={order.id}>
                    <td className={s.orderNo}>{order.orderNumber}</td>
                    <td>{formatMonthDay(order.createdAt)}</td>
                    <td>{order.orderer?.name ?? '—'}</td>
                    <td>{categoryLabel(order.category)}</td>
                    <td>{formatAmount(order.amount, order.currency)}</td>
                    <td>
                      <Badge tone={adminStatusTone(order.status)}>{statusLabel(order.status)}</Badge>
                    </td>
                    <td>
                      <Link href={orderDetailHref(order.id, listHref)} className={s.detailLink} aria-label={`${order.orderNumber} 상세`}>
                        상세
                      </Link>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        {/* 모바일(767px 이하)은 넓은 표 대신 카드 목록 — 가로 스크롤 없이 한눈에 본다 */}
        <ul className={s.mobileList}>
          {result.docs.length === 0 ? (
            <li className={s.empty}>{emptyText}</li>
          ) : (
            result.docs.map((order) => (
              <li key={order.id}>
                <Link href={orderDetailHref(order.id, listHref)} className={s.mItem} aria-label={`${order.orderNumber} 상세`}>
                  <span className={s.mTop}>
                    <span className={s.orderNo}>{order.orderNumber}</span>
                    <Badge tone={adminStatusTone(order.status)}>{statusLabel(order.status)}</Badge>
                  </span>
                  <span className={s.mMeta}>
                    {order.orderer?.name ?? '—'} · {formatMonthDay(order.createdAt)} · {categoryLabel(order.category)}
                  </span>
                  <span className={s.mBottom}>
                    <strong>{formatAmount(order.amount, order.currency)}</strong>
                    <span className={s.detailLink}>상세 ›</span>
                  </span>
                </Link>
              </li>
            ))
          )}
        </ul>
      </section>

      <nav className={s.pagination} aria-label="페이지">
        {result.page > 1 ? (
          <Link href={orderListHref(params, result.page - 1)} className={s.pageBtn} aria-label="이전 페이지">
            ‹
          </Link>
        ) : (
          <span className={`${s.pageBtn} ${s.pageDisabled}`} aria-hidden="true">
            ‹
          </span>
        )}
        {pageWindow(result.page, totalPages).map((n) => (
          <Link
            key={n}
            href={orderListHref(params, n)}
            className={`${s.pageBtn} ${n === result.page ? s.pageActive : ''}`}
            aria-current={n === result.page ? 'page' : undefined}
          >
            {n}
          </Link>
        ))}
        {result.page < totalPages ? (
          <Link href={orderListHref(params, result.page + 1)} className={s.pageBtn} aria-label="다음 페이지">
            ›
          </Link>
        ) : (
          <span className={`${s.pageBtn} ${s.pageDisabled}`} aria-hidden="true">
            ›
          </span>
        )}
      </nav>
      <p className={s.pageInfo} aria-live="polite">
        {Math.min(params.page, totalPages)} / {totalPages} 페이지 · 총 {result.totalDocs}건
      </p>
    </div>
  )
}
