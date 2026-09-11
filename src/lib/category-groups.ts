// 2·3·4번 카테고리의 화면 묶음(그룹)·항목 정의. 순수 데이터 — 계산도, DOM 도 모른다.
// `docs/카테고리-항목구성.md` 02·03·04 절을 그대로 옮겼다.
//
// scripts/seed-prices.ts 는 여기서 priced 항목의 key 를 읽어 단가를 심는다.
// 화면과 단가가 서로 다른 목록을 보면 키가 어긋나고, 어긋난 키는 계산기가
// "단가 없음"으로 통째로 거부한다 — 그래서 이 파일이 유일한 출처다.

export type ItemDef = {
  key: string
  /** 금액이 붙는 항목인지. false 면 선택은 하되 계산에 들어가지 않는다 (국가 선택, 별도문의 플래그 등) */
  priced: boolean
  /** 한국/일본 탭(3·4번)에서 어느 탭에 속하는지. 없으면 두 탭 모두에 보인다 */
  country?: 'kr' | 'jp'
  /** 중복 선택 그룹에서도 이 항목은 혼자만 고른다(예: "포스터 제작 안함") — 고르면 나머지를 비우고, 나머지를 고르면 이 항목을 뺀다 */
  exclusive?: true
}

export type GroupDef = {
  key: string
  /** true 면 체크박스(중복 선택), false 면 라디오(단일 선택) */
  multi: boolean
  items: ItemDef[]
}

export type CategoryForm = {
  groups: GroupDef[]
  /** 4번의 광고 기간. 다른 카테고리는 기간이 없다 */
  periods?: string[]
  /** 금액이 붙지 않는 자유 입력. 관리자 확인용 메모로만 쓴다 */
  freeText?: { key: string; maxLength: number }[]
  /** 한국/일본 탭으로 항목을 나눠 보여 주는지 (3·4번, Figma v2) */
  countryTabs?: boolean
}

const priced = (key: string): ItemDef => ({ key, priced: true })
const unpriced = (key: string): ItemDef => ({ key, priced: false })
const kr = (key: string): ItemDef => ({ key, priced: true, country: 'kr' })
const jp = (key: string): ItemDef => ({ key, priced: true, country: 'jp' })

// 2. 현지 전문 영상 제작 및 촬영
const category2: CategoryForm = {
  groups: [
    // 촬영 국가는 원본에 "(각 금액칸)" 표기가 없다 — 금액칸은 영상 종류·영상 길이에만 있다.
    // 그래서 국가는 중복 선택이지만 금액에 관여하지 않는 선택지로 둔다.
    { key: 'country', multi: true, items: [unpriced('country-kr'), unpriced('country-jp')] },
    {
      key: 'videoType',
      multi: false,
      items: [
        priced('video-type-company'),
        priced('video-type-product'),
        priced('video-type-store'),
        priced('video-type-event'),
        priced('video-type-documentary'),
        priced('video-type-etc'),
      ],
    },
    {
      key: 'videoLength',
      multi: false,
      items: [
        priced('video-length-10m'),
        priced('video-length-20m'),
        priced('video-length-30m'),
        priced('video-length-60m'),
      ],
    },
    // 기본 포함(영상 기획·편집·자막·배경음악·색보정·오프닝/엔딩)은 모든 상품에 들어가는
    // 안내일 뿐 선택지가 아니다 — 여기 items 에 넣지 않는다. 화면에는 안내문으로만 그린다.
  ],
}

// 3. 종이신문 / 전국신문 / 지역신문 / 블로그
const category3: CategoryForm = {
  countryTabs: true,
  groups: [
    {
      key: 'national',
      multi: true,
      items: [
        kr('national-kr-hankyung'),
        kr('national-kr-donga'),
        kr('national-kr-kyunghyang'),
        jp('national-jp-yomiuri'),
        jp('national-jp-asahi'),
        jp('national-jp-mainichi'),
      ],
    },
    {
      key: 'local',
      multi: true,
      items: [
        kr('local-kr-busan'),
        kr('local-kr-gangwon'),
        kr('local-kr-jeonnam'),
        jp('local-jp-hokkaido'),
        jp('local-jp-aichi'),
        jp('local-jp-fukuoka'),
      ],
    },
    {
      key: 'community',
      multi: true,
      items: [
        kr('community-kr-danggeun'),
        kr('community-kr-bulgnog'),
        jp('community-jp-jimoty'),
        jp('community-jp-mercari'),
      ],
    },
    {
      key: 'blog',
      multi: true,
      items: [
        jp('blog-note'),
        jp('blog-ameba'),
        jp('blog-hatena'),
        jp('blog-livedoor'),
        jp('blog-fc2'),
      ],
    },
  ],
}

// 4. 지하철 / 버스 / 옥외광고
// 2026-09-12 사용자 요청: 도시·포스터도 중복 선택. 금액은 고른 항목 합계(sumMultiplier)라 계산기는 그대로다
const category4: CategoryForm = {
  groups: [
    {
      key: 'subwayCity',
      multi: true,
      items: [
        kr('subway-city-seoul'),
        kr('subway-city-gyeonggi-incheon'),
        kr('subway-city-busan'),
        kr('subway-city-daegu'),
        kr('subway-city-etc'),
        jp('subway-city-tokyo'),
        jp('subway-city-osaka'),
        jp('subway-city-nagoya'),
        jp('subway-city-fukuoka'),
        jp('subway-city-jp-etc'),
      ],
    },
    {
      key: 'subwaySpot',
      multi: true,
      items: [
        priced('subway-spot-door-side'),
        priced('subway-spot-door-top'),
        priced('subway-spot-window-top'),
        priced('subway-spot-ceiling'),
      ],
    },
    // 포스터·전광판 제작 — Figma v2(2026-09-11 확정)에서 별도문의가 아니라 금액칸이 있는
    // 일반 항목이 됐다. 사이즈에 따라 달라지는 금액은 관리자가 단가를 고쳐 반영한다
    {
      key: 'posterBillboard',
      multi: true,
      items: [
        priced('poster-make-inquiry'),
        { key: 'poster-skip', priced: true, exclusive: true },
        priced('poster-video-image'),
        priced('poster-digital'),
      ],
    },
    {
      key: 'busCity',
      multi: true,
      items: [
        kr('bus-city-seoul'),
        kr('bus-city-gyeonggi-incheon'),
        kr('bus-city-busan'),
        kr('bus-city-daegu'),
        kr('bus-city-etc'),
        jp('bus-city-tokyo'),
        jp('bus-city-osaka'),
        jp('bus-city-nagoya'),
        jp('bus-city-fukuoka'),
        jp('bus-city-jp-etc'),
      ],
    },
    {
      key: 'busSpot',
      multi: true,
      items: [
        priced('bus-spot-outer-full'),
        priced('bus-spot-outer-side'),
        priced('bus-spot-inner'),
        priced('bus-spot-inner-monitor'),
      ],
    },
  ],
  periods: ['1w', '2w', '1m', '3m'],
  // 사이즈는 자유 입력이고 금액에 영향을 주지 않는다. 원문 그대로 화면에 그리지 않도록
  // 상한을 둔다 — 서버에서도 이 길이로 자른다 (GroupForm/서버 액션 쪽 책임)
  freeText: [{ key: 'size', maxLength: 200 }],
  countryTabs: true,
}

const FORMS: Record<number, CategoryForm> = { 2: category2, 3: category3, 4: category4 }

/** 카테고리 번호로 화면 묶음 정의를 찾는다. 1·5번과 없는 번호는 null — 던지지 않는다 */
export function formFor(no: number): CategoryForm | null {
  if (!Number.isInteger(no)) return null
  return FORMS[no] ?? null
}
