import Link from 'next/link'
import { notFound } from 'next/navigation'
import { AuthError, requireAdmin } from '@/lib/dal'
import { isSuperRole } from '@/lib/roles'
import { authedPayload } from '@/lib/admin/orders-data'
import { formFor } from '@/lib/category-groups'
import { PERIOD_KEYS } from '@/globals/PricingSettings'
import { PeriodMultiplierForm } from '@/components/admin/PeriodMultiplierForm'
import { PriceBoard, type PriceRow, type PriceSection } from '@/components/admin/PriceBoard'
import s from '@/components/admin/admin-v2.module.css'
import koMessages from '../../../../../../messages/ko.json'

/**
 * A8 단가 관리(Figma [v2] 230:2 / 230:117). 셸(사이드바·헤더)은 (gated)/layout 이 그린다 — 여기는 본문만.
 *
 * 조회는 관리자 전부, 저장은 super 만(API 가 최종 판정한다).
 * 카테고리 1~4 만 다룬다 — 5번은 문의 후 관리자가 견적을 발행하는 흐름이라 단가표가 없다.
 */
const CATEGORY_TABS = [
  { no: 1, label: '1. 디지털 · SNS' },
  { no: 2, label: '2. 현지 영상' },
  { no: 3, label: '3. 신문 · 블로그' },
  { no: 4, label: '4. 지하철 · 버스' },
] as const

const TIER_KEYS = ['basic', 'standard', 'premium'] as const

type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> }

export default async function PricesPage({ searchParams }: Props) {
  let user
  try {
    user = await requireAdmin()
  } catch (err) {
    if (err instanceof AuthError) notFound()
    throw err
  }
  const canEdit = isSuperRole(user.role)

  const sp = await searchParams
  const requested = Number(typeof sp.c === 'string' ? sp.c : '1')
  const category = CATEGORY_TABS.find((t) => t.no === requested)?.no ?? 1

  const { payload, user: payloadUser } = await authedPayload()
  const { docs } = await payload.find({
    collection: 'price-entries',
    where: { category: { equals: category } },
    sort: 'key',
    limit: 1000,
    depth: 0,
    user: payloadUser,
    overrideAccess: false,
  })
  const rows: PriceRow[] = docs.map((d) => ({
    id: d.id as number,
    key: d.key as string,
    labelKo: d.labelKo as string,
    labelJa: d.labelJa as string,
    priceKrw: d.priceKrw as number,
    priceJpy: d.priceJpy as number,
    active: Boolean(d.active),
  }))

  const settings =
    category === 4 ? await payload.findGlobal({ slug: 'pricing-settings', depth: 0, user: payloadUser, overrideAccess: false }) : null
  const periodLabels = koMessages.groupForm.periods as Record<string, string>
  const sections = buildSections(category, rows)

  return (
    <div className={s.page}>
      <div className={s.head}>
        <h1 className={s.title}>단가 관리</h1>
        <span className={s.superOnly}>최고관리자 전용</span>
      </div>
      <p className={s.lead}>
        항목별로 직접 입력합니다. 저장하면 고객 화면에 즉시 반영되지만, 이미 결제된 주문의 금액은 바뀌지 않습니다.
        {canEdit ? null : ' (중간관리자는 조회만 할 수 있습니다)'}
      </p>

      <nav className={s.tabs} aria-label="서비스">
        {CATEGORY_TABS.map((t) => (
          <Link key={t.no} href={`/manage/prices?c=${t.no}`} className={t.no === category ? `${s.tab} ${s.tabActive}` : s.tab} aria-current={t.no === category ? 'page' : undefined}>
            {t.label}
          </Link>
        ))}
      </nav>

      {rows.length === 0 ? (
        <p className={s.note}>등록된 단가가 없습니다.</p>
      ) : (
        // key 로 탭마다 새로 그려 초안 상태가 다른 탭으로 새지 않게 한다
        <PriceBoard key={category} sections={sections} canEdit={canEdit} />
      )}

      {category === 1 ? (
        <section className={s.card}>
          <div className={s.cardHead}>
            <h2 className={s.cardTitle}>플랫폼</h2>
            <span className={s.pillGray}>금액 없음</span>
          </div>
          <p className={s.hint}>플랫폼은 채널 선택일 뿐 금액에 영향을 주지 않습니다. 이름만 관리합니다.</p>
          {Object.values(koMessages.tierForm.platforms).map((name) => (
            <div key={name} className={s.platform}>
              {name}
            </div>
          ))}
        </section>
      ) : null}

      {settings ? (
        <section className={s.card}>
          <h2 className={s.cardTitle}>광고 기간별 배수</h2>
          <PeriodMultiplierForm
            periods={PERIOD_KEYS.map((key) => ({ key, label: periodLabels[key] ?? key }))}
            values={(settings.periodMultipliers ?? {}) as Record<string, number>}
            canEdit={canEdit}
          />
        </section>
      ) : null}

      <p className={s.warn}>저장하면 고객 화면 금액이 즉시 바뀝니다. 이미 결제된 주문과 발행된 계약서의 금액은 그대로 유지됩니다.</p>
    </div>
  )
}

/** 화면 묶음(등급·그룹)대로 단가 줄을 나눈다. 묶음에 없는 줄은 '기타 항목'으로 모아 빠뜨리지 않는다 */
function buildSections(category: number, rows: PriceRow[]): PriceSection[] {
  const byKey = new Map(rows.map((r) => [r.key, r]))
  const used = new Set<string>()
  const sections: PriceSection[] = []
  const take = (keys: readonly string[]) =>
    keys.flatMap((k) => {
      const r = byKey.get(k)
      if (!r) return []
      used.add(k)
      return [r]
    })

  if (category === 1) {
    const counts = koMessages.tierForm.rows[0] as Record<string, string>
    const tiers = take(TIER_KEYS).map((r) => ({ ...r, sub: counts[r.key] ? `총 콘텐츠 ${counts[r.key]}` : undefined }))
    if (tiers.length) sections.push({ title: '등급 단가', rows: tiers })
  } else {
    const titles = koMessages.groupForm.groupTitles as Record<string, string>
    for (const g of formFor(category)?.groups ?? []) {
      const list = take(g.items.filter((i) => i.priced).map((i) => i.key))
      if (list.length) sections.push({ title: titles[g.key] ?? g.key, rows: list })
    }
  }
  const rest = rows.filter((r) => !used.has(r.key))
  if (rest.length) sections.push({ title: '기타 항목', rows: rest })
  return sections
}
