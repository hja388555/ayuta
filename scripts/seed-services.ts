// 기존 1~5번 광고 서비스를 DB(ad-services · ad-service-groups)로 옮긴다. `pnpm seed:services`로 실행한다.
//
// key(서비스 번호·묶음 키·항목 키)가 이미 있으면 갱신하고 없으면 만든다(멱등) — seed-prices.ts 와 같은 구조.
//
// 항목은 새로 만들지 않는다. 금액과 이름은 이미 price-entries 에 있고, 여기서는 그 행을 키로 찾아
// 묶음 연결과 화면 속성(금액 여부·국가 탭·혼자 선택·순서)만 채운다 — 새로 만들면 같은 항목이 두 벌이 된다.
// 상수에는 있는데 단가 행이 없는 키는 건드리지 않고 목록으로 보고한다(단가 없는 항목은 지금도 화면에 안 보인다).
//
// 서비스 이름은 메인 목록 문구(messages/{ko,ja}.json 의 services.*)를 그대로 옮긴다.
// 화면이 DB 이름을 읽기 시작해도 지금과 같은 글자가 나와야 한다.
import { getPayload } from 'payload'
import config from '../src/payload.config.js'
import { servicesFromConstants } from '../src/lib/services/seed-shape'
import ko from '../messages/ko.json'
import ja from '../messages/ja.json'

// 메인 표지 문구라 cover.services 아래에 있다
const names = {
  ko: (ko as { cover: { services: Record<string, string> } }).cover.services,
  ja: (ja as { cover: { services: Record<string, string> } }).cover.services,
}

const payload = await getPayload({ config })

// 4번 기간 배수는 관리자가 저장한 값(pricing-settings)이 정본이다. 그 값을 그대로 옮긴다
const settings = (await payload.findGlobal({ slug: 'pricing-settings', overrideAccess: true, depth: 0 })) as {
  periodMultipliers?: Record<string, number>
}
const storedMultipliers = settings?.periodMultipliers ?? {}

const PERIOD_LABELS: Record<string, { ko: string; ja: string }> = {
  '1w': { ko: '1주', ja: '1週間' },
  '2w': { ko: '2주', ja: '2週間' },
  '1m': { ko: '1개월', ja: '1ヶ月' },
  '3m': { ko: '3개월', ja: '3ヶ月' },
}

const missingItems: string[] = []
let groupCount = 0
let linkedItems = 0

for (const service of servicesFromConstants()) {
  const nameKo = names.ko[service.slug] ?? service.slug
  const nameJa = names.ja[service.slug] ?? service.slug
  const periods = service.periods?.map((p) => ({
    key: p.key,
    labelKo: PERIOD_LABELS[p.key]?.ko ?? p.key,
    labelJa: PERIOD_LABELS[p.key]?.ja ?? p.key,
    multiplier: storedMultipliers[p.key] ?? 0,
  }))

  const found = await payload.find({
    collection: 'ad-services',
    where: { no: { equals: service.no } },
    limit: 1,
    overrideAccess: true,
  })

  const data = {
    nameKo,
    nameJa,
    model: service.model,
    contractMode: service.contractMode,
    sortOrder: service.sortOrder,
    active: true,
    ...(periods ? { periods } : {}),
  }

  let serviceId: number
  if (found.docs[0]) {
    const doc = found.docs[0]
    await payload.update({ collection: 'ad-services', id: doc.id, data, overrideAccess: true })
    serviceId = doc.id as number
    console.log(`서비스 갱신: ${service.no}. ${nameKo}`)
  } else {
    const created = await payload.create({
      collection: 'ad-services',
      data: { ...data, no: service.no, slug: service.slug },
      overrideAccess: true,
    })
    serviceId = created.id as number
    console.log(`서비스 생성: ${service.no}. ${nameKo}`)
  }

  for (const group of service.groups) {
    const groupData = {
      service: serviceId,
      titleKo: group.key,
      titleJa: group.key,
      multi: group.multi,
      countryTabs: group.countryTabs,
      axis: group.axis,
      sortOrder: group.sortOrder,
      active: true,
    }
    const foundGroup = await payload.find({
      collection: 'ad-service-groups',
      where: { and: [{ service: { equals: serviceId } }, { key: { equals: group.key } }] },
      limit: 1,
      overrideAccess: true,
    })

    let groupId: number
    if (foundGroup.docs[0]) {
      const doc = foundGroup.docs[0]
      // 제목은 관리자가 화면에서 고쳤을 수 있다 — 이미 있는 묶음의 이름은 덮어쓰지 않는다
      const { titleKo: _ko, titleJa: _ja, ...rest } = groupData
      await payload.update({ collection: 'ad-service-groups', id: doc.id, data: rest, overrideAccess: true })
      groupId = doc.id as number
    } else {
      const created = await payload.create({
        collection: 'ad-service-groups',
        data: { ...groupData, key: group.key },
        overrideAccess: true,
      })
      groupId = created.id as number
    }
    groupCount += 1

    for (const item of group.items) {
      const entry = await payload.find({
        collection: 'price-entries',
        where: { key: { equals: item.key } },
        limit: 1,
        overrideAccess: true,
      })
      if (!entry.docs[0]) {
        missingItems.push(item.key)
        continue
      }
      await payload.update({
        collection: 'price-entries',
        id: entry.docs[0].id,
        data: {
          group: groupId,
          priced: item.priced,
          ...(item.country ? { country: item.country } : {}),
          exclusive: item.exclusive,
          sortOrder: item.sortOrder,
        },
        overrideAccess: true,
      })
      linkedItems += 1
    }
  }
}

console.log(`묶음: ${groupCount}건, 연결한 항목: ${linkedItems}건`)
if (missingItems.length > 0) {
  console.log(`단가 행이 없어 건너뛴 항목 ${missingItems.length}건: ${missingItems.join(', ')}`)
}
