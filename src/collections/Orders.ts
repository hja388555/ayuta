import type { CollectionConfig } from 'payload'
import { isAdminRole, isSuperRole } from '../lib/roles'

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

export const Orders: CollectionConfig = {
  slug: 'orders',
  access: {
    // 주문 조회는 전부 서버 코드(DAL)를 거친다. REST 로는 아무도 못 읽는다
    read: ({ req: { user } }) => isAdminRole(user?.role),
    create: () => false, // Server Action 의 payload.create 만 쓴다 (overrideAccess)
    update: ({ req: { user } }) => isAdminRole(user?.role),
    delete: ({ req: { user } }) => isSuperRole(user?.role), // 전자상거래법 제6조: 실제로는 지우지 않는다
    unlock: () => false,
    admin: ({ req: { user } }) => isAdminRole(user?.role),
  },
  fields: [
    { name: 'orderNumber', type: 'text', required: true, unique: true, index: true },
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
      defaultValue: 'pending',
      index: true,
      options: ORDER_STATUSES.map((s) => ({ label: s, value: s })),
    },
    { name: 'currency', type: 'select', required: true, options: ['KRW', 'JPY'] },
    // 정수 최소단위. 원 = 1, 엔 = 1
    { name: 'amount', type: 'number', required: true },
    { name: 'locale', type: 'select', required: true, options: ['ko', 'ja'] },
    // 계약서 템플릿을 고른 카테고리 번호. 계약서·동의 항목을 나중에 다시 찾을 때 쓴다
    { name: 'category', type: 'number', required: true, min: 1, max: 5 },
    {
      // 금액과 항목명을 값으로 복사해 둔다.
      // 단가 ID만 참조하면 관리자가 단가를 고치는 순간 과거 주문 금액이 전부 바뀐다
      name: 'items',
      type: 'array',
      required: true,
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
      fields: [
        { name: 'label', type: 'text', required: true },
        { name: 'value', type: 'text', required: true },
      ],
    },
    { name: 'customer', type: 'relationship', relationTo: 'users', hasMany: false },
    {
      // 서명한 사람의 정보. 회원이어도 세션을 신뢰하지 않고 이 값을 다시 검증해 저장한다 —
      // customer 관계는 "누구 계정으로 결제했는지"이고, 이 값은 "계약서에 누가 서명했는지"다.
      // 비회원은 customer 가 비므로 이 값이 본인 확인의 유일한 근거가 된다
      name: 'orderer',
      type: 'group',
      required: true,
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
    { name: 'signature', type: 'text', required: true },
    // 결제 시점 계약서 전문. 값으로 복사한다 — 나중에 템플릿을 고쳐도 이미 체결된 주문은
    // 그 순간 고객이 읽고 서명한 문서 그대로 남아야 한다
    { name: 'contractText', type: 'textarea', required: true },
    { name: 'paidAt', type: 'date' },
    { name: 'failReason', type: 'text' },
  ],
}
