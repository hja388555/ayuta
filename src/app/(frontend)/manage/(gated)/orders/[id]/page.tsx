import { notFound } from 'next/navigation'
import { AuthError, requireAdmin } from '@/lib/dal'
import { isSuperRole } from '@/lib/roles'
import { findOrderForAdmin, findOrderNotes, findOrderTransitions } from '@/lib/admin/orders-data'
import { formatAmount, formatDateTime, formatDay, toDateInputValue } from '@/lib/admin/format'
import { adminStatusTone, categoryLabel } from '@/lib/admin/order-display'
import { availableTransitions, statusLabel } from '@/lib/orders/transitions'
import { AdminContractButton } from '@/components/admin/AdminContractButton'
import { OrderNoteForm } from '@/components/admin/OrderNoteForm'
import { OrderScheduleForm } from '@/components/admin/OrderScheduleForm'
import { OrderStatusForm } from '@/components/admin/OrderStatusForm'
import { td, th } from '@/components/admin/styles'
import { Badge } from '@/components/ui'
import s from '@/components/admin/AdminOrders.module.css'
import ko from '../../../../../../../messages/ko.json'
import type { User } from '@/payload-types'
import { sealDataUri } from '@/lib/seal'

type Props = { params: Promise<{ id: string }> }

/** 관계 필드는 depth 에 따라 id 이거나 문서다. 사람이 읽을 이름만 뽑는다 */
function actorName(value: number | User | null | undefined): string {
  if (value == null) return '시스템'
  if (typeof value === 'number') return `#${value}`
  return value.email ?? `#${value.id}`
}

const Row = ({ label, children }: { label: string; children: React.ReactNode }) => (
  <div className={s.kvRow}>
    <dt>{label}</dt>
    <dd>{children}</dd>
  </div>
)

/** 주문 상세(Figma [v2] A4 229:2 PC · 229:179 Mobile). 바깥 셸은 (gated) 레이아웃이 그린다 */
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

  const [notes, transitions, sealSrc] = await Promise.all([
    findOrderNotes(orderId),
    findOrderTransitions(orderId),
    sealDataUri(order.sealAsset as number | { id: number; filename?: string | null } | null | undefined),
  ])
  const isSuper = isSuperRole(user.role)
  const options = availableTransitions(order.status, { isSuper }).map((value) => ({
    value,
    label: statusLabel(value),
  }))
  const o = order.orderer
  const address = [o?.postcode ? `(${o.postcode})` : null, o?.address1, o?.address2].filter(Boolean).join(' ') || '—'
  const contractPeriod =
    order.contractStart || order.contractEnd ? `${formatDay(order.contractStart)} ~ ${formatDay(order.contractEnd)}` : '미정'

  return (
    <div className={s.page}>
      <div className={s.head}>
        <h1 className={s.title}>주문 상세</h1>
        <Badge tone={adminStatusTone(order.status)}>{statusLabel(order.status)}</Badge>
      </div>
      <p className={s.sub}>
        {order.orderNumber} · {formatDateTime(order.createdAt)}
      </p>

      <div className={s.grid}>
        <div className={s.col}>
          <section className={s.card}>
            <div className={s.cardHead}>
              <h2 className={s.cardTitle}>고객 정보</h2>
              {order.customer == null ? <Badge>비회원 주문</Badge> : <Badge tone="brand">회원 주문</Badge>}
            </div>
            <dl className={s.kv}>
              <Row label="주문자명">{o?.name ?? '—'}</Row>
              <Row label="대표자 성명">{o?.representative || '—'}</Row>
              <Row label="사업자등록번호">{o?.businessNo || '—'}</Row>
              <Row label="연락처">{o?.phone ?? '—'}</Row>
              <Row label="이메일">{o?.email ?? '—'}</Row>
              <Row label="주소">{address}</Row>
            </dl>
          </section>

          <section className={s.card}>
            <h2 className={s.cardTitle}>주문 내용</h2>
            <dl className={s.kv}>
              <Row label="광고 서비스">{categoryLabel(order.category)}</Row>
              {order.contractItems.map((item, i) => (
                <Row key={`${item.label}-${i}`} label={item.label}>
                  {item.value}
                </Row>
              ))}
              <Row label="결제일">{formatDateTime(order.paidAt)}</Row>
              <Row label="결제 금액">
                <span className={s.amount}>{formatAmount(order.amount, order.currency)}</span>
              </Row>
            </dl>
          </section>

          <section className={s.card}>
            <h2 className={s.cardTitle}>계약기간 · 광고 진행일 확정</h2>
            <p className={s.hint}>
              고객과 협의한 뒤 입력합니다. 저장하면 고객 계약서와 마이페이지에 즉시 반영되며, 광고 진행일은 환불 공제율의
              기준일이 됩니다.
            </p>
            <OrderScheduleForm
              orderId={order.id}
              initial={{
                contractStart: toDateInputValue(order.contractStart),
                contractEnd: toDateInputValue(order.contractEnd),
                adStartDate: toDateInputValue(order.adStartDate),
              }}
              extraAction={
                <AdminContractButton
                  modalMessages={ko.modal}
                  buttonClassName={`btn btn-outline ${s.bigBtn}`}
                  buttonLabel="계약서 보기"
                  closeLabel="닫기"
                  title={`계약서 · ${order.orderNumber}`}
                  facts={[
                    { label: '계약기간', value: contractPeriod },
                    { label: '광고 진행일', value: formatDay(order.adStartDate) },
                  ]}
                  notice={sealSrc ? undefined : '이 주문은 서명·날인 이미지 없이 체결됐습니다.'}
                  contractText={order.contractText}
                  seal={sealSrc ? { src: sealSrc, alt: '결제 시점 대표자 서명·날인' } : undefined}
                />
              }
            />
          </section>
        </div>

        <div className={s.col}>
          <section className={s.card}>
            <h2 className={s.cardTitle}>상태 변경</h2>
            <OrderStatusForm orderId={order.id} currentLabel={statusLabel(order.status)} options={options} />
            {!isSuper ? <p className={s.hint}>취소 처리는 super 권한만 할 수 있습니다.</p> : null}
          </section>

          <section className={s.card}>
            <h2 className={s.cardTitle}>연락 메모</h2>
            <OrderNoteForm orderId={order.id} />
            {notes.length === 0 ? (
              <p className={s.hint}>메모가 없습니다.</p>
            ) : (
              <ul className={s.logs} style={{ listStyle: 'none', margin: 0, padding: 0 }}>
                {notes.map((note) => (
                  <li key={note.id} className={s.log}>
                    <strong>
                      {formatDateTime(note.createdAt)} · {actorName(note.author)}
                    </strong>
                    <p>{note.body}</p>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className={s.card}>
            <h2 className={s.cardTitle}>기타</h2>
            <button type="button" className={`btn btn-outline btn-block ${s.bigBtn}`} disabled title="Q37 채팅 기능 연결 후 열립니다">
              고객 1:1 채팅 열기
            </button>
            <button type="button" className={`btn btn-outline btn-block ${s.bigBtn}`} disabled title="결제 연동 후 열립니다">
              환불 처리로 이동
            </button>
            <p className={s.hint}>1:1 채팅은 Q37, 환불 처리는 결제 연동 후 열립니다.</p>
          </section>
        </div>
      </div>

      <section className={s.card}>
        <h2 className={s.cardTitle}>상태 변경 이력</h2>
        <div className={s.tableWrap}>
          <table className={s.table}>
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
                    <td style={{ ...td, whiteSpace: 'normal' }}>{t.reason || '—'}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  )
}
