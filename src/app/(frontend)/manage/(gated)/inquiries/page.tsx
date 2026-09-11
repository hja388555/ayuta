import Link from 'next/link'
import { notFound } from 'next/navigation'
import { AuthError, requireAdmin } from '@/lib/dal'
import { authedPayload } from '@/lib/admin/orders-data'
import { formatDateTime } from '@/lib/admin/format'
import { countryText, firstLine, inquiryNumber, inquiryStatus } from '@/lib/admin/inquiry-display'
import { Badge } from '@/components/ui'
import { AdminChat } from '@/components/admin/AdminChat'
import { countUnreadThreads } from '@/lib/chat/service'
import s from './inquiries.module.css'

/** [v2] A9 문의·채팅. 기타 광고 문의 목록(최신순) · 1:1 채팅(?tab=chat, 큐 Q37) */
const PAGE_SIZE = 20
type Props = { searchParams: Promise<{ page?: string; tab?: string }> }

export default async function InquiriesPage({ searchParams }: Props) {
  try {
    await requireAdmin()
  } catch (err) {
    if (err instanceof AuthError) notFound()
    throw err
  }

  const sp = await searchParams
  const tab = sp.tab === 'chat' ? 'chat' : 'inquiries'
  const page = Math.max(1, Number.parseInt(sp.page ?? '1', 10) || 1)
  const { payload, user } = await authedPayload()
  const unreadChats = await countUnreadThreads(payload)
  const { docs, totalDocs, totalPages } = await payload.find({
    collection: 'inquiries',
    sort: '-createdAt',
    limit: PAGE_SIZE,
    page,
    depth: 0,
    user,
    overrideAccess: false,
  })

  return (
    <div className={s.page}>
      <h1 className={s.title}>문의 · 채팅</h1>
      <nav className={s.tabs} aria-label="문의 종류">
        <Link href="/manage/inquiries" className={tab === 'inquiries' ? `${s.tab} ${s.tabActive}` : s.tab} aria-current={tab === 'inquiries' ? 'page' : undefined}>
          기타 광고 문의 <span className={s.tabCount}>{totalDocs}</span>
        </Link>
        <Link href="/manage/inquiries?tab=chat" className={tab === 'chat' ? `${s.tab} ${s.tabActive}` : s.tab} aria-current={tab === 'chat' ? 'page' : undefined}>
          1:1 채팅 <span className={s.tabCount}>{unreadChats}</span>
        </Link>
      </nav>

      {tab === 'chat' ? <AdminChat /> : null}
      {tab === 'inquiries' ? (
      <>
      <section className={s.card}>
        {docs.length === 0 ? <p className={s.muted}>접수된 문의가 없습니다.</p> : null}
        {docs.map((d) => {
          const st = inquiryStatus(d.status)
          const href = `/manage/inquiries/${d.id}`
          return (
            <article key={d.id} className={s.item}>
              <div className={s.itemHead}>
                <span className={s.itemNo}>{inquiryNumber(d.id as number, d.createdAt as string)}</span>
                <Badge tone={st.tone}>{st.label}</Badge>
              </div>
              <div className={s.itemWho}>
                <span className={s.itemName}>{d.name as string}</span>
                <span className={s.dot}>·</span>
                <span className={s.itemCountry}>{countryText(d.country)}</span>
              </div>
              <p className={s.itemBody}>{firstLine(d.body)}</p>
              <span className={s.itemMeta}>접수 {formatDateTime(d.createdAt as string)}</span>
              <div className={s.actions}>
                <Link href={`${href}#quote`} className="btn btn-primary">
                  견적 발행
                </Link>
                <Link href={href} className="btn btn-outline">
                  상세
                </Link>
              </div>
            </article>
          )
        })}
      </section>

      {totalPages > 1 ? (
        <nav className={s.pager} aria-label="페이지">
          {page > 1 ? <Link href={`?page=${page - 1}`} className="btn btn-outline">이전</Link> : null}
          <span>
            {page} / {totalPages}
          </span>
          {page < totalPages ? <Link href={`?page=${page + 1}`} className="btn btn-outline">다음</Link> : null}
        </nav>
      ) : null}
      </>
      ) : null}
    </div>
  )
}
