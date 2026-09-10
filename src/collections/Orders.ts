import type { CollectionConfig } from 'payload'
import { isAdminRole } from '../lib/roles'
import { isVerifiedAdmin, isVerifiedSuper } from '../lib/admin-access'

// 결제 계획의 다섯 상태에
// in_progress · done 두 상태를 더한다 — 견적/주문 스파인 계획이 요구하는 전체 상태다.
export const ORDER_STATUSES = [
  'pending',
  'paid',
  'in_progress',
  'done',
  'failed',
  'cancelled',
  'fraud_suspected',
] as const
export type OrderStatus = (typeof ORDER_STATUSES)[number]

// 스냅샷 필드에 붙이는 필드 레벨 잠금. 결제 시점에 값으로 복사해 둔 것들이라
// 나중에 어떤 경로로도 바뀌면 안 된다(계약서 전문·금액·항목·서명·주문자·주문번호 등).
// 서버 코드는 payload.create(overrideAccess: true) 또는 raw SQL로 쓰므로 이 잠금에
// 걸리지 않는다 — 막히는 건 admin UI와 REST/GraphQL 의 update 뿐이다.
const IMMUTABLE = { update: () => false } as const

// 같은 모양이지만 뜻이 다른 잠금. IMMUTABLE 은 "영원히 안 바뀐다"이고, 이쪽은
// "바뀌긴 하는데 전용 경로(원자적 UPDATE + append-only 이력)로만 바뀐다"이다.
// 둘을 한 상수로 합치면 나중에 IMMUTABLE 을 푸는 순간 이력이 필요한 필드까지 같이
// 열린다 — 이름으로 구분해 둔다.
const MANAGED_ELSEWHERE = { update: () => false } as const

const SCHEDULE_ADMIN = {
  readOnly: true,
  description: '주문 상세의 계약기간 저장 경로로만 변경됩니다. 변경 이력이 남습니다.',
} as const

export const Orders: CollectionConfig = {
  slug: 'orders',
  admin: {
    useAsTitle: 'orderNumber',
    defaultColumns: ['orderNumber', 'status', 'currency', 'amount', 'category', 'createdAt'],
    listSearchableFields: ['orderNumber', 'paymentId'],
  },
  access: {
    // 고객 개인정보·계약서 전문이 담긴다. REST·GraphQL·/admin 모두 이 access 를 쓰므로
    // role 만 보면 2단계 인증을 거치지 않은 관리자 세션이 /manage 게이트를 옆으로 돌아간다.
    // 고객 본인 조회(order-lookup)는 서버 코드가 overrideAccess 로 따로 한다.
    read: ({ req }) => isVerifiedAdmin(req),
    create: () => false, // Server Action 의 payload.create 만 쓴다 (overrideAccess)
    update: ({ req }) => isVerifiedAdmin(req),
    delete: ({ req }) => isVerifiedSuper(req), // 전자상거래법 제6조: 실제로는 지우지 않는다
    unlock: () => false,
    admin: ({ req: { user } }) => isAdminRole(user?.role),
  },
  fields: [
    { name: 'orderNumber', type: 'text', required: true, unique: true, index: true, access: IMMUTABLE },
    // 포트원에 넘긴 결제 식별자. 웹훅과 복귀 경로가 이 값으로 주문을 찾는다
    { name: 'paymentId', type: 'text', required: true, unique: true, index: true },
    // 결제 버튼 더블클릭·재시도로 같은 요청이 두 번 와도 주문이 두 벌 생기지 않도록
    // createOrder가 이 값으로 기존 주문을 먼저 찾는다(Ruling 15). 없을 수도 있으므로
    // unique이되 required는 아니다 — Postgres는 NULL끼리 유니크 충돌로 안 본다
    { name: 'idempotencyKey', type: 'text', unique: true, index: true },
    {
      name: 'status',
      type: 'select',
      required: true,
      // 상태는 transitionOrder()만 바꾼다. 그 함수는 조건부 UPDATE 한 번과 order_transitions
      // INSERT 를 같은 트랜잭션으로 묶어 원자적 전이와 append-only 감사 기록을 보장한다.
      // admin UI 의 일반 저장이 그 경로를 우회하면 전이 기록에 구멍이 생기고, append-only
      // 표라서 나중에 메워 넣을 수도 없다 — 그래서 읽기전용 + update 거부로 잠근다.
      admin: { readOnly: true },
      access: { update: () => false },
      defaultValue: 'pending',
      index: true,
      options: ORDER_STATUSES.map((s) => ({ label: s, value: s })),
    },
    { name: 'currency', type: 'select', required: true, options: ['KRW', 'JPY'], access: IMMUTABLE },
    // 정수 최소단위. 원 = 1, 엔 = 1
    { name: 'amount', type: 'number', required: true, access: IMMUTABLE },
    { name: 'locale', type: 'select', required: true, options: ['ko', 'ja'] },
    // 계약서 템플릿을 고른 카테고리 번호. 계약서·동의 항목을 나중에 다시 찾을 때 쓴다
    { name: 'category', type: 'number', required: true, min: 1, max: 5, access: IMMUTABLE },
    {
      // 금액과 항목명을 값으로 복사해 둔다.
      // 단가 ID만 참조하면 관리자가 단가를 고치는 순간 과거 주문 금액이 전부 바뀐다
      name: 'items',
      type: 'array',
      required: true,
      access: IMMUTABLE,
      fields: [
        { name: 'code', type: 'text', required: true },
        { name: 'label', type: 'text', required: true },
        { name: 'unitAmount', type: 'number', required: true },
        { name: 'quantity', type: 'number', required: true, defaultValue: 1 },
      ],
    },
    {
      // 가격이 없는 선택(국가, 채널, 사이즈 등)까지 포함한 전체 선택 — 계약서 전문에 이미
      // 들어 있지만, 관리자가 주문 목록에서 계약서 전문을 열지 않고도 "뭘 샀는지" 바로
      // 보게 하려고 값으로 따로 복사해 둔다(items는 금액칸이 있는 것만 담는다)
      name: 'contractItems',
      type: 'array',
      required: true,
      access: IMMUTABLE,
      fields: [
        { name: 'label', type: 'text', required: true },
        { name: 'value', type: 'text', required: true },
      ],
    },
    // 표지(cover)에서 고른 나라·목적. 가격에 관여하지 않지만 "무엇을 파는지"를 설명하는
    // 값이라 카테고리와 무관하게 저장한다 — 계약서 문구에 실리는지는 카테고리별 소스
    // 문서가 있는지에 달렸다(createOrder/contract-items.ts 참고).
    { name: 'country', type: 'select', hasMany: true, options: ['kr', 'jp'] },
    {
      name: 'purpose',
      type: 'select',
      options: ['brand', 'product', 'store', 'medical', 'event', 'etc'],
    },
    { name: 'customer', type: 'relationship', relationTo: 'users', hasMany: false },
    {
      // 서명한 사람의 정보. 회원이어도 세션을 신뢰하지 않고 이 값을 다시 검증해 저장한다 —
      // customer 관계는 "누구 계정으로 결제했는지"이고, 이 값은 "계약서에 누가 서명했는지"다.
      // 비회원은 customer 가 비므로 이 값이 본인 확인의 유일한 근거가 된다
      name: 'orderer',
      type: 'group',
      required: true,
      access: IMMUTABLE,
      fields: [
        { name: 'name', type: 'text', required: true },
        { name: 'phone', type: 'text', required: true },
        { name: 'email', type: 'email', required: true },
        { name: 'postcode', type: 'text', required: true },
        { name: 'address1', type: 'text', required: true },
        { name: 'address2', type: 'text' },
        { name: 'businessNo', type: 'text' },
        { name: 'representative', type: 'text' },
      ],
    },
    // 전자서명 이름. 동의 체크 시 주문자 이름이 그대로 들어간다(손으로 그리는 서명이 아니다) —
    // createOrder 가 orderer.name 과 다르면 거부하므로 여기 저장된 값은 항상 orderer.name 과 같다
    { name: 'signature', type: 'text', required: true, access: IMMUTABLE },
    // 결제 시점 계약서 전문. 값으로 복사한다 — 나중에 템플릿을 고쳐도 이미 체결된 주문은
    // 그 순간 고객이 읽고 서명한 문서 그대로 남아야 한다
    { name: 'contractText', type: 'textarea', required: true, access: IMMUTABLE },
    // 계약기간·광고시작일 (Q22-B). 계약서 스냅샷(contractText)에 써넣지 않고 별도 컬럼에
    // 담는다 — 스냅샷은 고객이 읽고 서명한 문서 그대로여야 하므로 확정된 날짜를 나중에
    // 그 안에 끼워 넣으면 "서명한 문서"가 아니게 된다. 고객 화면은 스냅샷과 이 컬럼을
    // 따로 읽어 합성해 보여준다(src/lib/order-lookup.ts).
    //
    // 이 세 필드는 setOrderSchedule()(src/lib/orders/schedule.ts) 로만 바뀐다. admin UI 의
    // 일반 저장은 order-schedule-changes 이력을 남기지 않고 역순 기간 검증도 거치지
    // 않으므로, 그 경로가 열려 있으면 이력이 감사 근거가 되지 못한다 — 그래서
    // 읽기전용 + update 거부로 잠그고 POST /api/admin/orders/schedule 하나만 남긴다.
    // setOrderSchedule() 은 payload.db.pool 에서 뽑은 client 로 raw SQL 을 실행하므로
    // 필드 레벨 access 를 아예 통과하지 않는다 — 이 잠금에 걸리지 않는다.
    { name: 'contractStart', type: 'date', access: MANAGED_ELSEWHERE, admin: SCHEDULE_ADMIN },
    { name: 'contractEnd', type: 'date', access: MANAGED_ELSEWHERE, admin: SCHEDULE_ADMIN },
    { name: 'adStartDate', type: 'date', access: MANAGED_ELSEWHERE, admin: SCHEDULE_ADMIN },
    { name: 'paidAt', type: 'date' },
    { name: 'failReason', type: 'text' },
  ],
}
