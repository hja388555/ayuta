// 금액이 붙지 않는 선택지를 단가 행으로 심는다(2026-09-16). `pnpm seed:unpriced` 로 실행한다.
//
// 지금까지 이런 선택지(2번 촬영 국가, 1번 플랫폼)는 화면 정의(코드)에만 있고 price-entries 에는
// 없었다. 화면이 DB 만 읽기 시작하면 이 선택지가 통째로 사라진다 — 그래서 금액 0 원,
// priced: false 로 행을 만들어 둔다. 계산기는 priced 를 보지 않고 화면이 합산에서 뺀다.
//
// 이미 있으면 건드리지 않는다(금액을 0 으로 덮어쓰지 않는다).
import { getPayload } from 'payload'
import config from '../src/payload.config.js'

type Row = { key: string; labelKo: string; labelJa: string; category: number }

const ROWS: Row[] = [
  // 1번 플랫폼 — 채널 선택일 뿐 금액에 영향이 없다(calculators/tier.ts)
  { key: 'instagram', labelKo: '인스타그램 (피드, 캐러셀, 릴스)', labelJa: 'インスタグラム（フィード、カルーセル、リール）', category: 1 },
  { key: 'youtube', labelKo: '유튜브, 쇼츠', labelJa: 'YouTube、ショート', category: 1 },
  { key: 'tiktok', labelKo: '틱톡 (숏폼영상)', labelJa: 'TikTok（ショート動画）', category: 1 },
  { key: 'line', labelKo: '라인 (이미지, 메시지 콘텐츠)', labelJa: 'LINE（画像、メッセージコンテンツ）', category: 1 },
  // 2번 촬영 국가 — 금액칸이 없는 선택지다(category-groups.ts 주석)
  { key: 'country-kr', labelKo: '한국 현지 촬영', labelJa: '韓国現地撮影', category: 2 },
  { key: 'country-jp', labelKo: '일본 현지 촬영', labelJa: '日本現地撮影', category: 2 },
]

const payload = await getPayload({ config })

let created = 0
let skipped = 0
for (const row of ROWS) {
  const found = await payload.find({
    collection: 'price-entries',
    where: { key: { equals: row.key } },
    limit: 1,
    overrideAccess: true,
  })
  if (found.docs[0]) {
    console.log(`이미 있음: ${row.key}`)
    skipped += 1
    continue
  }
  await payload.create({
    collection: 'price-entries',
    data: { ...row, priceKrw: 0, priceJpy: 0, active: true, priced: false },
    overrideAccess: true,
  })
  console.log(`생성: ${row.key} (금액 0, 선택지 전용)`)
  created += 1
}
console.log(`생성 ${created}건, 건너뜀 ${skipped}건`)
