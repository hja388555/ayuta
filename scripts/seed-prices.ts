// 임시 단가 시드 스크립트. `pnpm seed:prices`로 실행한다.
// 금액은 전부 임시값이며 대표님이 관리자 화면에서 실제 단가로 바꾼다.
// key가 이미 있으면 갱신하고 없으면 새로 만든다 (멱등) — `scripts/seed-admins.ts`와 같은 구조.
//
// label은 UI 카피가 아니다 — PriceBook → QuoteLine.label → orders.items.label 로 흘러
// 계약서의 상품명이 된다. 그래서 key를 복사한 placeholder가 아니라 실제 한국어/일본어
// 이름을 심는다 (docs/카테고리-항목구성.md 원본).
import { getPayload } from 'payload'
import config from '../src/payload.config.js'
import { formFor } from '../src/lib/category-groups'

type SeedEntry = {
  key: string
  labelKo: string
  labelJa: string
  category: number
  priceKrw: number
  priceJpy: number
}

// docs/카테고리-항목구성.md 에 명시된 이름은 그대로 옮겼다. 일본어가 원문에 없는
// 한국 매체/항목명은 이 스크립트 작성 시점에 초벌로 지어 넣었다 — 대표님 검수가 필요하다
// (보고서에 목록을 남긴다).
const LABELS_KO: Record<string, string> = {
  'video-type-company': '회사·기업 소개',
  'video-type-product': '제품·상품 소개',
  'video-type-store': '매장·병원 소개',
  'video-type-event': '행사·이벤트',
  'video-type-documentary': '다큐멘터리',
  'video-type-etc': '기타',
  'video-length-10m': '10분',
  'video-length-20m': '20분',
  'video-length-30m': '30분',
  'video-length-60m': '60분',

  'national-kr-hankyung': '한국경제 신문',
  'national-kr-donga': '동아일보',
  'national-kr-kyunghyang': '경향신문',
  'national-jp-yomiuri': '요미우리 신문',
  'national-jp-asahi': '아사히 신문',
  'national-jp-mainichi': '마이니치 신문',

  'local-kr-busan': '부산',
  'local-kr-gangwon': '강원도',
  'local-kr-jeonnam': '전라남도',
  'local-jp-hokkaido': '홋카이도',
  'local-jp-aichi': '아이치 나고야',
  'local-jp-fukuoka': '후쿠오카 규슈',

  'community-kr-danggeun': '당근 (동네 커뮤니티)',
  'community-kr-bulgnog': '벼룩신문 (온라인/오프라인)',
  'community-jp-jimoty': '지모티 (한국의 당근마켓)',
  'community-jp-mercari': '메르카리 (한국의 벼룩시장)',

  'blog-note': '노트(note)',
  'blog-ameba': '아메바 블로그',
  'blog-hatena': '하테나 블로그',
  'blog-livedoor': '라이브도어',
  'blog-fc2': 'FC2 블로그',

  'subway-city-seoul': '서울',
  'subway-city-gyeonggi-incheon': '경기·인천',
  'subway-city-busan': '부산',
  'subway-city-daegu': '대구',
  'subway-city-etc': '기타지역',
  'subway-city-tokyo': '도쿄',
  'subway-city-osaka': '오사카',
  'subway-city-nagoya': '나고야',
  'subway-city-fukuoka': '후쿠오카',
  'subway-city-jp-etc': '기타지역',

  'subway-spot-door-side': '차량 문옆',
  'subway-spot-door-top': '차량 문위',
  'subway-spot-window-top': '창위',
  'subway-spot-ceiling': '천장 길이',

  'bus-city-seoul': '서울',
  'bus-city-gyeonggi-incheon': '경기·인천',
  'bus-city-busan': '부산',
  'bus-city-daegu': '대구',
  'bus-city-etc': '기타지역',
  'bus-city-tokyo': '도쿄',
  'bus-city-osaka': '오사카',
  'bus-city-nagoya': '나고야',
  'bus-city-fukuoka': '후쿠오카',
  'bus-city-jp-etc': '기타지역',

  'bus-spot-outer-full': '버스 외부 전체 광고',
  'bus-spot-outer-side': '버스 외부 측면 광고',
  'bus-spot-inner': '버스 내부 광고',
  'bus-spot-inner-monitor': '버스 내부 모니터 광고',
}

// 일본어 — national/local/community 의 일본 매체명, blog 5종(모두 일본 플랫폼)은
// docs 원문에 있는 이름을 옮겼다. 한국 매체/도시/위치명의 일본어는 원문에 없어 이 스크립트
// 작성 시 초벌로 지었다 — LABELS_JA_DRAFT 로 따로 표시해 보고서에서 구분한다.
export const LABELS_JA_DRAFT = new Set<string>([
  'video-type-company',
  'video-type-product',
  'video-type-store',
  'video-type-event',
  'video-type-documentary',
  'video-type-etc',
  'video-length-10m',
  'video-length-20m',
  'video-length-30m',
  'video-length-60m',
  'national-kr-hankyung',
  'national-kr-donga',
  'national-kr-kyunghyang',
  'local-kr-busan',
  'local-kr-gangwon',
  'local-kr-jeonnam',
  'community-kr-danggeun',
  'community-kr-bulgnog',
  'subway-city-seoul',
  'subway-city-gyeonggi-incheon',
  'subway-city-busan',
  'subway-city-daegu',
  'subway-city-etc',
  'subway-spot-door-side',
  'subway-spot-door-top',
  'subway-spot-window-top',
  'subway-spot-ceiling',
  'bus-city-seoul',
  'bus-city-gyeonggi-incheon',
  'bus-city-busan',
  'bus-city-daegu',
  'bus-city-etc',
  'bus-spot-outer-full',
  'bus-spot-outer-side',
  'bus-spot-inner',
  'bus-spot-inner-monitor',
])

const LABELS_JA: Record<string, string> = {
  'video-type-company': '会社・企業紹介',
  'video-type-product': '製品・商品紹介',
  'video-type-store': '店舗・病院紹介',
  'video-type-event': 'イベント',
  'video-type-documentary': 'ドキュメンタリー',
  'video-type-etc': 'その他',
  'video-length-10m': '10分',
  'video-length-20m': '20分',
  'video-length-30m': '30分',
  'video-length-60m': '60分',

  'national-kr-hankyung': '韓国経済新聞',
  'national-kr-donga': '東亜日報',
  'national-kr-kyunghyang': '京郷新聞',
  'national-jp-yomiuri': '読売新聞',
  'national-jp-asahi': '朝日新聞',
  'national-jp-mainichi': '毎日新聞',

  'local-kr-busan': '釜山',
  'local-kr-gangwon': '江原道',
  'local-kr-jeonnam': '全羅南道',
  'local-jp-hokkaido': '北海道',
  'local-jp-aichi': '愛知（名古屋）',
  'local-jp-fukuoka': '福岡（九州）',

  'community-kr-danggeun': 'タングン（地域コミュニティ）',
  'community-kr-bulgnog': 'ビョロク新聞（オンライン/オフライン）',
  'community-jp-jimoty': 'ジモティー',
  'community-jp-mercari': 'メルカリ',

  'blog-note': 'note',
  'blog-ameba': 'アメーバブログ',
  'blog-hatena': 'はてなブログ',
  'blog-livedoor': 'ライブドアブログ',
  'blog-fc2': 'FC2ブログ',

  'subway-city-seoul': 'ソウル',
  'subway-city-gyeonggi-incheon': '京畿・仁川',
  'subway-city-busan': '釜山',
  'subway-city-daegu': '大邱',
  'subway-city-etc': 'その他地域',
  'subway-city-tokyo': '東京',
  'subway-city-osaka': '大阪',
  'subway-city-nagoya': '名古屋',
  'subway-city-fukuoka': '福岡',
  'subway-city-jp-etc': 'その他地域',

  'subway-spot-door-side': '車両ドア横',
  'subway-spot-door-top': '車両ドア上',
  'subway-spot-window-top': '窓上',
  'subway-spot-ceiling': '天井広告',

  'bus-city-seoul': 'ソウル',
  'bus-city-gyeonggi-incheon': '京畿・仁川',
  'bus-city-busan': '釜山',
  'bus-city-daegu': '大邱',
  'bus-city-etc': 'その他地域',
  'bus-city-tokyo': '東京',
  'bus-city-osaka': '大阪',
  'bus-city-nagoya': '名古屋',
  'bus-city-fukuoka': '福岡',
  'bus-city-jp-etc': 'その他地域',

  'bus-spot-outer-full': 'バス外部全面広告',
  'bus-spot-outer-side': 'バス外部側面広告',
  'bus-spot-inner': 'バス車内広告',
  'bus-spot-inner-monitor': 'バス車内モニター広告',
}

const labelFor = (key: string): { labelKo: string; labelJa: string } => {
  const labelKo = LABELS_KO[key]
  const labelJa = LABELS_JA[key]
  if (!labelKo || !labelJa) throw new Error(`라벨이 없는 키입니다: ${key} — LABELS_KO/LABELS_JA 에 추가하세요`)
  return { labelKo, labelJa }
}

// 키를 이 파일에서 다시 손으로 적으면 화면(category-groups.ts)과 단가가 따로 논다 —
// 하나가 한 글자만 어긋나도 항목은 뜨는데 단가가 없어 계산이 통째로 거부된다.
// 그래서 priced 항목의 key 는 반드시 category-groups.ts 에서 읽는다.
const derivedEntries = (category: 2 | 3 | 4, priceKrw: number, priceJpy: number): SeedEntry[] => {
  const form = formFor(category)
  if (!form) throw new Error(`카테고리 ${category}의 화면 묶음 정의가 없습니다`)
  return form.groups.flatMap((g) =>
    g.items
      .filter((i) => i.priced)
      .map((i) => ({ key: i.key, ...labelFor(i.key), category, priceKrw, priceJpy })),
  )
}

const ENTRIES: SeedEntry[] = [
  // 1번 디지털 · SNS 커뮤니티 — 등급 (중복 선택, 합산)
  { key: 'basic', labelKo: '베이직', labelJa: 'ベーシック', category: 1, priceKrw: 1_000_000, priceJpy: 100_000 },
  { key: 'standard', labelKo: '스탠다드', labelJa: 'スタンダード', category: 1, priceKrw: 2_000_000, priceJpy: 200_000 },
  { key: 'premium', labelKo: '프리미엄', labelJa: 'プレミアム', category: 1, priceKrw: 3_000_000, priceJpy: 300_000 },

  // 2번 현지 영상 제작 — 영상 종류 · 영상 길이만 금액칸을 가진다 (국가는 금액 없음, 시드 대상 아님)
  ...derivedEntries(2, 1_000_000, 100_000),

  // 3번 신문 · 블로그 — 전국지 > 지역신문 > 커뮤니티 > 블로그 순으로 임시 단가를 낮춰 잡는다
  ...derivedEntries(3, 800_000, 80_000),

  // 4번 지하철 · 버스 — 항목 합산 후 기간 배수를 곱한다 (배수표는 category-groups.ts periods)
  ...derivedEntries(4, 1_000_000, 100_000),
]

// 시드가 다루는 카테고리(2~4)에서, 화면 정의(category-groups.ts)에 더 이상 없는 키를
// 가진 행을 찾는다. 1번은 이 스크립트가 화면 정의를 읽지 않으므로(하드코딩) 손대지 않는다.
const SEEDED_CATEGORIES = [2, 3, 4] as const
const seededKeys = new Set(ENTRIES.map((e) => e.key))

const main = async () => {
  const payload = await getPayload({ config })

  for (const entry of ENTRIES) {
    const existing = await payload.find({
      collection: 'price-entries',
      where: { key: { equals: entry.key } },
      limit: 1,
      overrideAccess: true,
    })

    if (existing.docs[0]) {
      await payload.update({
        collection: 'price-entries',
        id: existing.docs[0].id,
        data: { ...entry, active: true },
        overrideAccess: true,
      })
      console.log(`갱신: ${entry.key}`)
      continue
    }

    await payload.create({
      collection: 'price-entries',
      data: { ...entry, active: true },
      overrideAccess: true,
    })
    console.log(`생성: ${entry.key}`)
  }

  // 리네임/삭제로 화면에서 사라진 항목을 지우지 않고 active: false 로만 내린다.
  // 삭제하면 과거 주문 스냅샷과의 연결 단서(관리자 조회)까지 함께 사라진다 —
  // loadPriceBook 은 active 로 걸러내므로 비활성 행은 어차피 견적에 닿지 않는다.
  let deactivated = 0
  for (const category of SEEDED_CATEGORIES) {
    const { docs } = await payload.find({
      collection: 'price-entries',
      where: { and: [{ category: { equals: category } }, { active: { equals: true } }] },
      limit: 1000,
      overrideAccess: true,
    })
    for (const doc of docs) {
      if (seededKeys.has(doc.key as string)) continue
      await payload.update({
        collection: 'price-entries',
        id: doc.id,
        data: { active: false },
        overrideAccess: true,
      })
      deactivated += 1
      console.log(`비활성화: ${doc.key}`)
    }
  }
  console.log(`비활성화된 행: ${deactivated}건`)

  await payload.destroy()
}

// payload run은 import()가 끝나는 즉시 프로세스를 종료시킨다.
// top-level await로 main()이 끝날 때까지 모듈 평가 자체를 붙잡아 둔다
try {
  await main()
} catch (err) {
  console.error(err)
  process.exit(1)
}
