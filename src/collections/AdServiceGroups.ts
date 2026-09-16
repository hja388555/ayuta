import type { CollectionConfig } from 'payload'
import { isAdminRole } from '../lib/roles'
import { isActiveSuper } from '../lib/admin-access'

// 주문 화면의 묶음 한 줄(예: 촬영 국가, 영상 종류). 항목은 price-entries 가 들고,
// 이 표는 어떤 묶음이 어떤 순서로 보이는지만 정한다.
//
// key 는 만든 뒤 못 바꾼다 — 항목 키(s<번호>-<묶음키>-<n>)가 이 값에서 만들어지고,
// 항목 키는 계산기가 단가를 찾는 이름이라 한 글자만 달라져도 견적이 통째로 거부된다.
export const AdServiceGroups: CollectionConfig = {
  slug: 'ad-service-groups',
  admin: {
    useAsTitle: 'titleKo',
    defaultColumns: ['service', 'key', 'titleKo', 'multi', 'sortOrder', 'active'],
  },
  access: {
    read: () => true,
    create: ({ req }) => isActiveSuper(req),
    update: ({ req }) => isActiveSuper(req),
    delete: () => false,
    unlock: () => false,
    admin: ({ req: { user } }) => isAdminRole(user?.role),
  },
  fields: [
    { name: 'service', type: 'relationship', relationTo: 'ad-services', required: true, index: true },
    { name: 'key', type: 'text', required: true, index: true, access: { update: () => false } },
    { name: 'titleKo', type: 'text', required: true },
    { name: 'titleJa', type: 'text', required: true },
    { name: 'hintKo', type: 'text' },
    { name: 'hintJa', type: 'text' },
    { name: 'multi', type: 'checkbox', required: true, defaultValue: false },
    { name: 'countryTabs', type: 'checkbox', required: true, defaultValue: false },
    // videoPairs(종류 × 길이) 방식에서 이 묶음이 어느 축인지. 다른 방식은 none
    { name: 'axis', type: 'select', required: true, defaultValue: 'none', options: ['none', 'type', 'length'] },
    { name: 'sortOrder', type: 'number', required: true, defaultValue: 100 },
    { name: 'active', type: 'checkbox', required: true, defaultValue: true },
  ],
}
