import { getPayload } from 'payload'
import config from '@payload-config'

// 1번 계약서(디지털/SNS)만 제10조 아래에 "광고 신청 및 계약정보 (자동 채움)" {{items}} 표를
// 넣는다 (2026-09-18 요청 — 서명 직전에 주문 내역을 다시 확인한다). 시드를 통째로 되돌리는
// SEED_FORCE 대신 저장된 원문을 그대로 두고 블록만 끼워 넣는다 — 관리자가 손본 문구가 있으면
// 그것을 덮어쓰지 않아야 한다. 이미 블록이 있으면 건너뛰므로 여러 번 돌려도 안전하다.
const BLOCKS = {
  ko: {
    anchor: '갑 (고객 / 광고주)',
    block: '광고 신청 및 계약정보 (자동 채움)\n{{items}}\n총 계약금액: {{amount}}\n\n',
  },
  ja: {
    anchor: '甲（お客様／広告主）',
    block: '広告申請及び契約情報（自動入力）\n{{items}}\n総契約金額: {{amount}}\n\n',
  },
} as const

const main = async () => {
  const payload = await getPayload({ config })

  for (const locale of ['ko', 'ja'] as const) {
    const { docs } = await payload.find({
      collection: 'contract-templates',
      where: { and: [{ category: { equals: 1 } }, { locale: { equals: locale } }] },
      limit: 10,
      overrideAccess: true,
    })

    for (const doc of docs) {
      const body = doc.body as string
      const { anchor, block } = BLOCKS[locale]
      if (body.includes('{{items}}')) {
        console.log(`건너뜀(이미 있음): locale=${locale} id=${doc.id}`)
        continue
      }
      if (!body.includes(anchor)) {
        console.log(`건너뜀(기준 문구 없음): locale=${locale} id=${doc.id}`)
        continue
      }
      const next = body.replace(anchor, block + anchor)
      await payload.update({ collection: 'contract-templates', id: doc.id, data: { body: next }, overrideAccess: true })
      console.log(`갱신: locale=${locale} id=${doc.id} ${body.length} -> ${next.length}`)
    }
  }

  await payload.destroy()
}

try {
  await main()
} catch (err) {
  console.error(err)
  process.exit(1)
}
