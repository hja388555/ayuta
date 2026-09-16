import { notFound } from 'next/navigation'
import Link from 'next/link'
import { AuthError, requireAdmin } from '@/lib/dal'
import { isSuperRole } from '@/lib/roles'
import { authedPayload } from '@/lib/admin/orders-data'
import { ServiceBoard, type GroupCard, type ItemRow } from '@/components/admin/ServiceBoard'
import s from '@/components/admin/admin-v2.module.css'

/**
 * 광고 서비스 편집(Figma [v3] 13-B 425:2 / 430:2). 셸은 (gated)/layout 이 그린다.
 *
 * 기본 정보 · 묶음 · 항목을 한 화면에서 고친다. 저장은 줄 단위로 관리자 API 를 부른다
 * (단가 화면과 같은 방식 — 화면에서 Payload REST 를 직접 부르지 않는다).
 */
export default async function ServiceEditPage({ params }: { params: Promise<{ id: string }> }) {
  let user
  try {
    user = await requireAdmin()
  } catch (err) {
    if (err instanceof AuthError) notFound()
    throw err
  }

  const { id } = await params
  const serviceId = Number(id)
  if (!Number.isInteger(serviceId) || serviceId <= 0) notFound()

  const { payload, user: payloadUser } = await authedPayload()
  const service = await payload
    .findByID({ collection: 'ad-services', id: serviceId, depth: 0, user: payloadUser, overrideAccess: false })
    .catch(() => null)
  if (!service) notFound()

  const groups = await payload.find({
    collection: 'ad-service-groups',
    where: { service: { equals: serviceId } },
    sort: 'sortOrder',
    limit: 100,
    depth: 0,
    user: payloadUser,
    overrideAccess: false,
  })

  const items = await payload.find({
    collection: 'price-entries',
    where: { group: { in: groups.docs.map((g) => g.id as number) } },
    sort: 'sortOrder',
    limit: 500,
    depth: 0,
    user: payloadUser,
    overrideAccess: false,
  })

  const byGroup = new Map<number, ItemRow[]>()
  for (const e of items.docs) {
    const groupId = typeof e.group === 'object' && e.group ? (e.group as { id: number }).id : (e.group as number | null)
    if (!groupId) continue
    const row: ItemRow = {
      id: e.id as number,
      key: e.key as string,
      labelKo: e.labelKo as string,
      labelJa: e.labelJa as string,
      priceKrw: e.priceKrw as number,
      priceJpy: e.priceJpy as number,
      priced: e.priced !== false,
      exclusive: e.exclusive === true,
      country: (e.country ?? null) as ItemRow['country'],
      sortOrder: (e.sortOrder ?? 100) as number,
      active: e.active !== false,
    }
    byGroup.set(groupId, [...(byGroup.get(groupId) ?? []), row])
  }

  const cards: GroupCard[] = groups.docs.map((g) => ({
    id: g.id as number,
    key: g.key as string,
    titleKo: g.titleKo as string,
    titleJa: g.titleJa as string,
    multi: g.multi === true,
    countryTabs: g.countryTabs === true,
    axis: (g.axis ?? 'none') as GroupCard['axis'],
    sortOrder: (g.sortOrder ?? 100) as number,
    active: g.active !== false,
    items: byGroup.get(g.id as number) ?? [],
  }))

  return (
    <div className={s.page}>
      <div className={s.head}>
        <h1 className={s.title}>광고 서비스 편집 — {service.nameKo as string}</h1>
        <Link className={s.backLink} href="/manage/services">
          목록으로
        </Link>
      </div>

      <ServiceBoard
        service={{
          id: serviceId,
          no: service.no as number,
          slug: service.slug as string,
          nameKo: service.nameKo as string,
          nameJa: service.nameJa as string,
          descKo: (service.descKo ?? '') as string,
          descJa: (service.descJa ?? '') as string,
          model: service.model as string,
          contractMode: service.contractMode as 'fixed' | 'perQuote',
          sortOrder: service.sortOrder as number,
          active: service.active !== false,
        }}
        groups={cards}
        canEdit={isSuperRole(user.role)}
      />
    </div>
  )
}
