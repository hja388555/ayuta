import 'server-only'
import { getPayload } from 'payload'
import config from '@payload-config'
import type { CategoryForm, GroupDef, ItemDef } from '../category-groups'

/**
 * DB(ad-services · ad-service-groups · price-entries)에서 광고 서비스 정의를 읽는다(2026-09-16).
 *
 * 지금까지 서비스·묶음은 코드 상수(categories.ts · category-groups.ts)였다. 관리자가 서비스를
 * 추가·편집하려면 이 정의가 DB 에 있어야 한다. 화면 컴포넌트는 손대지 않는다 — 여기서 기존
 * CategoryForm 과 같은 모양으로 조립해 넘긴다.
 *
 * 캐시하지 않는다. 관리자가 저장한 값이 다음 요청부터 바로 보여야 한다(loadPriceBook 과 같은 판단).
 * DB 가 비어 있으면 null 을 돌려주고, 호출하는 쪽이 기존 상수로 폴백한다 — 전환 도중에도
 * 화면이 멈추지 않게 한다.
 */
export type ServiceDef = {
  no: number
  slug: string
  nameKo: string
  nameJa: string
  model: 'tier' | 'sum' | 'sumMultiplier' | 'videoPairs' | 'inquiry'
  contractMode: 'fixed' | 'perQuote'
  sortOrder: number
  periods?: { key: string; labelKo: string; labelJa: string; multiplier: number }[]
}

export type GroupRow = {
  key: string
  multi: boolean
  countryTabs: boolean
  axis: 'none' | 'type' | 'length'
  sortOrder: number
}

export type ItemRow = {
  key: string
  groupKey: string
  priced: boolean
  country: 'kr' | 'jp' | null
  exclusive: boolean
  sortOrder: number
}

const byOrder = <T extends { sortOrder: number; key: string }>(a: T, b: T) =>
  a.sortOrder - b.sortOrder || a.key.localeCompare(b.key)

/**
 * 묶음·항목 행을 화면이 쓰는 폼 정의로 조립한다. 순수 함수 — DB 도 Payload 도 모른다.
 *
 * 항목이 하나도 연결되지 않은 묶음은 뺀다. 단가 행이 지워졌거나 아직 안 심긴 묶음을 그대로
 * 그리면 화면에 제목만 남은 빈 칸이 생긴다.
 */
export function formFromRows(groups: GroupRow[], items: ItemRow[]): CategoryForm {
  const sortedGroups = [...groups].sort(byOrder)
  const defs: GroupDef[] = []
  for (const group of sortedGroups) {
    const mine = items.filter((i) => i.groupKey === group.key).sort(byOrder)
    if (mine.length === 0) continue
    defs.push({
      key: group.key,
      multi: group.multi,
      items: mine.map((i): ItemDef => ({
        key: i.key,
        priced: i.priced,
        ...(i.country ? { country: i.country } : {}),
        // 기존 정의는 혼자 선택인 항목에만 이 값을 달았다 — 같은 모양을 지킨다
        ...(i.exclusive ? { exclusive: true as const } : {}),
      })),
    })
  }
  return {
    groups: defs,
    ...(sortedGroups.some((g) => g.countryTabs) ? { countryTabs: true } : {}),
  }
}

type ServiceDoc = {
  no: number
  slug: string
  nameKo: string
  nameJa: string
  model: ServiceDef['model']
  contractMode: ServiceDef['contractMode']
  sortOrder: number
  periods?: { key: string; labelKo: string; labelJa: string; multiplier: number }[] | null
}

const toService = (doc: ServiceDoc): ServiceDef => ({
  no: doc.no,
  slug: doc.slug,
  nameKo: doc.nameKo,
  nameJa: doc.nameJa,
  model: doc.model,
  contractMode: doc.contractMode,
  sortOrder: doc.sortOrder,
  ...(doc.periods && doc.periods.length > 0 ? { periods: doc.periods } : {}),
})

/** 공개된 서비스를 메인 목록 순서대로. DB 가 비어 있으면 빈 배열 */
export async function loadServices(): Promise<ServiceDef[]> {
  const payload = await getPayload({ config })
  const { docs } = await payload.find({
    collection: 'ad-services',
    where: { active: { equals: true } },
    sort: 'sortOrder',
    limit: 100,
    depth: 0,
    overrideAccess: true,
  })
  return (docs as unknown as ServiceDoc[]).map(toService)
}

/** 주문 주소(slug)로 서비스 하나. 없거나 내려둔 서비스면 null */
export async function loadServiceBySlug(slug: string): Promise<ServiceDef | null> {
  const payload = await getPayload({ config })
  const { docs } = await payload.find({
    collection: 'ad-services',
    where: { and: [{ slug: { equals: slug } }, { active: { equals: true } }] },
    limit: 1,
    depth: 0,
    overrideAccess: true,
  })
  const doc = docs[0] as unknown as ServiceDoc | undefined
  return doc ? toService(doc) : null
}

/** 서비스 번호로 주문 화면 폼 정의. 묶음이 없으면 null — 호출하는 쪽이 기존 상수로 폴백한다 */
export async function loadServiceForm(no: number): Promise<CategoryForm | null> {
  const payload = await getPayload({ config })
  const service = await payload.find({
    collection: 'ad-services',
    where: { no: { equals: no } },
    limit: 1,
    depth: 0,
    overrideAccess: true,
  })
  const serviceId = service.docs[0]?.id
  if (!serviceId) return null

  const groups = await payload.find({
    collection: 'ad-service-groups',
    where: { and: [{ service: { equals: serviceId } }, { active: { equals: true } }] },
    sort: 'sortOrder',
    limit: 100,
    depth: 0,
    overrideAccess: true,
  })
  if (groups.docs.length === 0) return null

  const groupRows = groups.docs.map((g) => ({
    id: g.id as number,
    row: {
      key: g.key as string,
      multi: g.multi === true,
      countryTabs: g.countryTabs === true,
      axis: (g.axis ?? 'none') as GroupRow['axis'],
      sortOrder: (g.sortOrder ?? 100) as number,
    },
  }))

  const entries = await payload.find({
    collection: 'price-entries',
    where: { and: [{ group: { in: groupRows.map((g) => g.id) } }, { active: { equals: true } }] },
    limit: 500,
    depth: 0,
    overrideAccess: true,
  })

  const groupKeyById = new Map(groupRows.map((g) => [g.id, g.row.key]))
  const itemRows: ItemRow[] = []
  for (const e of entries.docs) {
    const groupId = typeof e.group === 'object' && e.group ? (e.group as { id: number }).id : (e.group as number | null)
    const groupKey = groupId ? groupKeyById.get(groupId) : undefined
    if (!groupKey) continue
    itemRows.push({
      key: e.key as string,
      groupKey,
      priced: e.priced !== false,
      country: (e.country ?? null) as ItemRow['country'],
      exclusive: e.exclusive === true,
      sortOrder: (e.sortOrder ?? 100) as number,
    })
  }

  const form = formFromRows(
    groupRows.map((g) => g.row),
    itemRows,
  )
  return form.groups.length > 0 ? form : null
}
