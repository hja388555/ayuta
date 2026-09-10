import Link from 'next/link'
import { notFound } from 'next/navigation'
import { AuthError, requireAdmin } from '@/lib/dal'
import { isSuperRole } from '@/lib/roles'
import { authedPayload } from '@/lib/admin/orders-data'
import { PERIOD_KEYS } from '@/globals/PricingSettings'
import { PriceRowForm } from '@/components/admin/PriceRowForm'
import { PeriodMultiplierForm } from '@/components/admin/PeriodMultiplierForm'
import { card, th } from '@/components/admin/styles'
import koMessages from '../../../../../../messages/ko.json'

/**
 * 단가·기간 배수 관리. 대표님이 임시값을 실제 값으로 바꾸는 화면이다.
 *
 * 조회는 관리자 전부, 저장은 super 만(API 가 최종 판정한다).
 * 카테고리 1~4 만 다룬다 — 5번은 문의 후 관리자가 견적을 발행하는 흐름이라 단가표가 없다.
 */
const CATEGORY_TABS = [
  { no: 1, label: '1. 디지털·SNS' },
  { no: 2, label: '2. 현지 영상 제작' },
  { no: 3, label: '3. 대표신문·지역신문·블로그' },
  { no: 4, label: '4. 지하철·버스·블로그' },
] as const

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

  const settings =
    category === 4 ? await payload.findGlobal({ slug: 'pricing-settings', depth: 0, user: payloadUser, overrideAccess: false }) : null
  const periodLabels = koMessages.groupForm.periods as Record<string, string>

  return (
    <main style={{ padding: 40, fontFamily: 'sans-serif', color: '#3D4046' }}>
      <p style={{ margin: '0 0 8px' }}>
        <Link href="/manage">← 관리자 홈</Link>
      </p>
      <h1 style={{ fontSize: 20, marginBottom: 8 }}>단가 관리</h1>
      <p style={{ fontSize: 13, color: '#767B85', marginTop: 0 }}>
        저장하면 다음 견적·결제부터 바로 반영됩니다. 이미 만들어진 주문의 금액과 계약서는 바뀌지 않습니다.
        {canEdit ? null : ' (중간관리자는 조회만 할 수 있습니다)'}
      </p>

      <nav style={{ display: 'flex', gap: 8, flexWrap: 'wrap', margin: '16px 0' }}>
        {CATEGORY_TABS.map((t) => (
          <Link
            key={t.no}
            href={`/manage/prices?c=${t.no}`}
            style={{
              padding: '6px 12px',
              borderRadius: 4,
              fontSize: 13,
              textDecoration: 'none',
              border: '1px solid #D6D9DE',
              background: t.no === category ? '#3D4046' : '#fff',
              color: t.no === category ? '#fff' : '#3D4046',
            }}
          >
            {t.label}
          </Link>
        ))}
      </nav>

      {settings ? (
        <section style={card}>
          <h2 style={{ fontSize: 15, margin: '0 0 12px' }}>광고 기간별 배수</h2>
          <PeriodMultiplierForm
            periods={PERIOD_KEYS.map((key) => ({ key, label: periodLabels[key] ?? key }))}
            values={(settings.periodMultipliers ?? {}) as Record<string, number>}
            canEdit={canEdit}
          />
        </section>
      ) : null}

      <section style={card}>
        <table style={{ borderCollapse: 'collapse', width: '100%' }}>
          <thead>
            <tr>
              <th style={th}>항목</th>
              <th style={th}>원화 (₩)</th>
              <th style={th}>엔화 (¥)</th>
              <th style={th}>판매</th>
              <th style={th} />
            </tr>
          </thead>
          <tbody>
            {docs.map((d) => (
              <PriceRowForm
                key={d.id}
                id={d.id as number}
                keyName={d.key as string}
                labelKo={d.labelKo as string}
                labelJa={d.labelJa as string}
                priceKrw={d.priceKrw as number}
                priceJpy={d.priceJpy as number}
                active={Boolean(d.active)}
                canEdit={canEdit}
              />
            ))}
          </tbody>
        </table>
        {docs.length === 0 ? <p style={{ fontSize: 13, color: '#767B85' }}>등록된 단가가 없습니다.</p> : null}
      </section>
    </main>
  )
}
