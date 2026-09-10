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
}

const priced = (key: string): ItemDef => ({ key, priced: true })
const unpriced = (key: string): ItemDef => ({ key, priced: false })

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
  groups: [
    {
      key: 'national',
      multi: true,
      items: [
        priced('national-kr-hankyung'),
        priced('national-kr-donga'),
        priced('national-kr-kyunghyang'),
        priced('national-jp-yomiuri'),
        priced('national-jp-asahi'),
        priced('national-jp-mainichi'),
      ],
    },
    {
      key: 'local',
      multi: true,
      items: [
        priced('local-kr-busan'),
        priced('local-kr-gangwon'),
        priced('local-kr-jeonnam'),
        priced('local-jp-hokkaido'),
        priced('local-jp-aichi'),
        priced('local-jp-fukuoka'),
      ],
    },
    {
      key: 'community',
      multi: true,
      items: [
        priced('community-kr-danggeun'),
        priced('community-kr-bulgnog'),
        priced('community-jp-jimoty'),
        priced('community-jp-mercari'),
      ],
    },
    {
      key: 'blog',
      multi: true,
      items: [
        priced('blog-note'),
        priced('blog-ameba'),
        priced('blog-hatena'),
        priced('blog-livedoor'),
        priced('blog-fc2'),
      ],
    },
  ],
}

// 4. 지하철 / 버스 / 옥외광고
const category4: CategoryForm = {
  groups: [
    {
      key: 'subwayCity',
      multi: false,
      items: [
        priced('subway-city-seoul'),
        priced('subway-city-gyeonggi-incheon'),
        priced('subway-city-busan'),
        priced('subway-city-daegu'),
        priced('subway-city-etc'),
        priced('subway-city-tokyo'),
        priced('subway-city-osaka'),
        priced('subway-city-nagoya'),
        priced('subway-city-fukuoka'),
        priced('subway-city-jp-etc'),
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
    // 포스터·전광판 제작은 금액이 없는 별도문의 플래그다. 계산에 넣지 않고
    // 선택지로만 두어 주문 메모에 실린다 (별도문의 처리는 화면 쪽 책임)
    {
      key: 'posterBillboard',
      multi: false,
      items: [unpriced('poster-make-inquiry'), unpriced('poster-skip')],
    },
    {
      key: 'busCity',
      multi: false,
      items: [
        priced('bus-city-seoul'),
        priced('bus-city-gyeonggi-incheon'),
        priced('bus-city-busan'),
        priced('bus-city-daegu'),
        priced('bus-city-etc'),
        priced('bus-city-tokyo'),
        priced('bus-city-osaka'),
        priced('bus-city-nagoya'),
        priced('bus-city-fukuoka'),
        priced('bus-city-jp-etc'),
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
}

const FORMS: Record<number, CategoryForm> = { 2: category2, 3: category3, 4: category4 }

/** 카테고리 번호로 화면 묶음 정의를 찾는다. 1·5번과 없는 번호는 null — 던지지 않는다 */
export function formFor(no: number): CategoryForm | null {
  if (!Number.isInteger(no)) return null
  return FORMS[no] ?? null
}
