import Link from 'next/link'
import { Badge } from '@/components/ui'
import { authedPayload } from '@/lib/admin/orders-data'
import { statusTone } from '@/lib/mypage/status'
import { statusLabel } from '@/lib/orders/transitions'
import { formatMonthDay } from '@/lib/admin/order-display'
import o from '@/components/admin/AdminOrders.module.css'
import s from './dashboard.module.css'

// 게이트(requireAdmin)는 (gated)/layout.tsx 가 한다. 여기는 세션 사용자 권한으로 읽기만 한다
export const dynamic = 'force-dynamic'

const CATEGORY_LABEL: Record<number, string> = {
  1: '1. 디지털 · SNS',
  2: '2. 현지 영상',
  3: '3. 신문 · 블로그',
  4: '4. 지하철 · 버스',
  5: '5. 기타',
}
const REVENUE_STATUSES = ['paid', 'in_progress', 'done']

/** 서울 기준 오늘 0시와 이번 달 1일 0시(UTC Date) */
function seoulBoundaries(now = new Date()) {
  const ymd = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Seoul', year: 'numeric', month: '2-digit', day: '2-digit' }).format(now)
  return {
    today: new Date(`${ymd}T00:00:00+09:00`).toISOString(),
    month: new Date(`${ymd.slice(0, 8)}01T00:00:00+09:00`).toISOString(),
  }
}

const won = (n: number) => n.toLocaleString('ko-KR')

async function loadDashboard() {
  const { payload, user } = await authedPayload()
  const opts = { user, overrideAccess: false } as const
  const { today, month } = seoulBoundaries()

  const [todayOrders, awaiting, newInquiries, monthOrders, recent, unreadChats] = await Promise.all([
    payload.count({ collection: 'orders', where: { createdAt: { greater_than_equal: today } }, ...opts }),
    payload.count({ collection: 'orders', where: { status: { equals: 'paid' } }, ...opts }),
    payload.count({ collection: 'inquiries', where: { status: { equals: 'new' } }, ...opts }),
    payload.find({
      collection: 'orders',
      where: { and: [{ status: { in: REVENUE_STATUSES } }, { createdAt: { greater_than_equal: month } }] },
      pagination: false,
      depth: 0,
      select: { amount: true, currency: true },
      ...opts,
    }),
    payload.find({ collection: 'orders', sort: '-createdAt', limit: 5, depth: 0, ...opts }),
    // 채팅 컬렉션은 REST 가 전부 닫혀 있어 세션 권한으로는 못 읽는다 — 게이트는 layout 이 이미 했다
    payload.count({ collection: 'chat-threads', where: { unreadForAdmin: { greater_than: 0 } }, overrideAccess: true }),
  ])

  let revenueKrw = 0
  let jpyCount = 0
  for (const o of monthOrders.docs) {
    if (o.currency === 'KRW') revenueKrw += Number(o.amount) || 0
    else jpyCount += 1
  }
  return {
    todayOrders: todayOrders.totalDocs,
    awaiting: awaiting.totalDocs,
    newInquiries: newInquiries.totalDocs,
    unreadChats: unreadChats.totalDocs,
    revenueKrw,
    jpyCount,
    recent: recent.docs,
  }
}

function Kpi({ label, value, unit, tone, hint }: { label: string; value: string; unit?: string; tone?: 'danger' | 'muted'; hint?: string }) {
  return (
    <div className={s.kpi}>
      <p className={s.kpiLabel}>{label}</p>
      <div className={s.kpiValue}>
        <span className={`${s.num} ${tone ? s[tone] : ''}`}>{value}</span>
        {unit ? <span className={s.unit}>{unit}</span> : null}
      </div>
      {hint ? <p className={s.kpiHint}>{hint}</p> : null}
    </div>
  )
}

export default async function ManageDashboard() {
  const d = await loadDashboard()
  const checks = [
    d.awaiting > 0 ? { href: '/manage/orders?status=paid', text: `접수 확인이 안 된 주문 ${d.awaiting}건이 있습니다` } : null,
    d.newInquiries > 0 ? { href: '/manage/inquiries', text: `답변을 기다리는 새 문의 ${d.newInquiries}건이 있습니다` } : null,
    d.unreadChats > 0 ? { href: '/manage/inquiries?tab=chat', text: `읽지 않은 1:1 채팅 ${d.unreadChats}건이 있습니다` } : null,
  ].filter((c): c is { href: string; text: string } => c !== null)

  return (
    <div className={s.page}>
      <h1 className={s.title}>대시보드</h1>

      <section className={s.kpis} aria-label="주요 지표">
        <Kpi label="오늘 주문" value={String(d.todayOrders)} unit="건" />
        <Kpi label="접수 대기" value={String(d.awaiting)} unit="건" />
        <Kpi label="환불 신청" value="-" tone="muted" hint="결제 연동 후" />
        <Kpi label="이번 달 매출" value={won(d.revenueKrw)} unit="원" hint={d.jpyCount > 0 ? `엔화 주문 ${d.jpyCount}건 별도` : undefined} />
      </section>

      {checks.length > 0 ? (
        <section className={s.alert}>
          <h2 className={s.alertHead}>
            <img className={s.alertIcon} src="/ui/admin-alert.svg" alt="" width={20} height={20} />
            확인이 필요한 항목
          </h2>
          {checks.map((c) => (
            <p key={c.href} className={s.alertLine}>
              · <Link href={c.href}>{c.text}</Link>
            </p>
          ))}
        </section>
      ) : null}

      <section className={s.card}>
        <div className={s.cardHead}>
          <h2 className={s.cardTitle}>최근 주문</h2>
          <Link href="/manage/orders" className={s.more}>
            전체 보기
          </Link>
        </div>
        <div className={`${s.tableWrap} ${s.recentTable}`}>
          <table className={s.table}>
            <thead>
              <tr>
                <th>주문번호</th>
                <th>주문일</th>
                <th>고객</th>
                <th>서비스</th>
                <th>금액</th>
                <th>상태</th>
              </tr>
            </thead>
            <tbody>
              {d.recent.length === 0 ? (
                <tr>
                  <td colSpan={6} className={s.empty}>
                    아직 주문이 없습니다
                  </td>
                </tr>
              ) : (
                d.recent.map((r) => (
                  <tr key={r.id}>
                    <td>
                      <Link href={`/manage/orders/${r.id}`} className={s.orderNo}>
                        {r.orderNumber}
                      </Link>
                    </td>
                    <td>{formatMonthDay(r.createdAt)}</td>
                    <td>{r.orderer?.name ?? '-'}</td>
                    <td>{CATEGORY_LABEL[r.category] ?? r.category}</td>
                    <td>
                      {r.currency === 'JPY' ? '¥' : '₩'} {won(r.amount)}
                    </td>
                    <td>
                      <Badge tone={statusTone(r.status)}>{statusLabel(r.status)}</Badge>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        {/* 모바일은 주문 목록 화면과 같은 카드 목록(날짜 표기도 같은 formatMonthDay) */}
        <ul className={o.mobileList}>
          {d.recent.length === 0 ? (
            <li className={s.empty}>아직 주문이 없습니다</li>
          ) : (
            d.recent.map((r) => (
              <li key={r.id}>
                <Link href={`/manage/orders/${r.id}`} className={o.mItem} aria-label={`${r.orderNumber} 상세`}>
                  <span className={o.mTop}>
                    <span className={o.orderNo}>{r.orderNumber}</span>
                    <Badge tone={statusTone(r.status)}>{statusLabel(r.status)}</Badge>
                  </span>
                  <span className={o.mMeta}>
                    {r.orderer?.name ?? '-'} · {formatMonthDay(r.createdAt)} · {CATEGORY_LABEL[r.category] ?? r.category}
                  </span>
                  <span className={o.mBottom}>
                    <strong>
                      {r.currency === 'JPY' ? '¥' : '₩'} {won(r.amount)}
                    </strong>
                    <span className={o.detailLink}>상세 ›</span>
                  </span>
                </Link>
              </li>
            ))
          )}
        </ul>
      </section>
    </div>
  )
}
