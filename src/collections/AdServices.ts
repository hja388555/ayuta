import type { CollectionConfig } from 'payload'
import { isAdminRole } from '../lib/roles'
import { isActiveSuper } from '../lib/admin-access'

// 광고 서비스 한 줄. 지금까지 코드 상수(src/lib/categories.ts)였던 1~5번이 여기로 들어오고,
// 관리자가 만드는 6번 이후도 같은 표에 쌓인다.
//
// no(번호)와 slug(주소)는 만든 뒤 못 바꾼다 — 주문·계약서·단가가 번호로 서로를 찾고,
// 주소는 고객이 이미 공유한 링크다. 바뀌면 조용히 다른 서비스를 가리킨다.
export const AdServices: CollectionConfig = {
  slug: 'ad-services',
  admin: {
    useAsTitle: 'nameKo',
    defaultColumns: ['no', 'nameKo', 'model', 'contractMode', 'sortOrder', 'active'],
  },
  access: {
    // 메인·주문 화면이 로그인 없이 읽는다
    read: () => true,
    create: ({ req }) => isActiveSuper(req),
    update: ({ req }) => isActiveSuper(req),
    // 지운 서비스의 옛 주문이 가리킬 곳을 잃는다. 내릴 때는 active: false 로
    delete: () => false,
    unlock: () => false,
    admin: ({ req: { user } }) => isAdminRole(user?.role),
  },
  fields: [
    { name: 'no', type: 'number', required: true, unique: true, index: true, min: 1, access: { update: () => false } },
    { name: 'slug', type: 'text', required: true, unique: true, index: true, access: { update: () => false } },
    { name: 'nameKo', type: 'text', required: true },
    { name: 'nameJa', type: 'text', required: true },
    { name: 'descKo', type: 'text' },
    { name: 'descJa', type: 'text' },
    {
      name: 'model',
      type: 'select',
      required: true,
      options: ['tier', 'sum', 'sumMultiplier', 'videoPairs', 'inquiry'],
      admin: { description: '계산 방식입니다. 주문이 들어온 뒤 바꾸면 과거 주문과 계산이 어긋납니다.' },
    },
    {
      name: 'contractMode',
      type: 'select',
      required: true,
      defaultValue: 'fixed',
      options: ['fixed', 'perQuote'],
      admin: { description: 'fixed = 미리 쓴 계약서, perQuote = 견적 발행 때마다 작성' },
    },
    { name: 'sortOrder', type: 'number', required: true, defaultValue: 100 },
    { name: 'active', type: 'checkbox', required: true, defaultValue: true },
    {
      // 기간 배수(4번 방식). 전역 설정(pricing-settings)에 있던 값을 서비스마다 갖게 한다
      name: 'periods',
      type: 'array',
      fields: [
        { name: 'key', type: 'text', required: true },
        { name: 'labelKo', type: 'text', required: true },
        { name: 'labelJa', type: 'text', required: true },
        { name: 'multiplier', type: 'number', required: true, min: 0 },
      ],
    },
  ],
}
