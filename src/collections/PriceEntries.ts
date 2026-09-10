import type { CollectionConfig } from 'payload'
import { isAdminRole, isSuperRole } from '../lib/roles'

export const PriceEntries: CollectionConfig = {
  slug: 'price-entries',
  access: {
    // 단가는 견적 화면에 그대로 나가므로 읽기는 공개
    read: () => true,
    // 단가 변경은 곧 매출 변경이다. 최고관리자만
    create: ({ req: { user } }) => isSuperRole(user?.role),
    update: ({ req: { user } }) => isSuperRole(user?.role),
    delete: ({ req: { user } }) => isSuperRole(user?.role),
    unlock: () => false,
    admin: ({ req: { user } }) => isAdminRole(user?.role),
  },
  fields: [
    {
      name: 'key',
      type: 'text',
      required: true,
      unique: true,
      index: true,
      // 카테고리 2 계산기는 axes.join('__')로 조회 키를 만든다. 축 값 안에 __가
      // 들어 있으면 ['a__b']와 ['a','b']가 같은 키로 충돌한다 — 키가 만들어지는
      // 여기서 막아야 계산기 쪽에서 조용히 잘못된 단가를 집는 일이 없다.
      validate: (value: string | null | undefined) => {
        if (typeof value === 'string' && value.includes('__')) {
          return '키에는 "__"를 포함할 수 없습니다 (카테고리 2 조회 키 구분자와 충돌합니다).'
        }
        return true
      },
    },
    // label 하나로 두 언어를 감당할 수 없다 — 계약서는 법적 문서이고 견적 시점의
    // 언어로 고정돼야 한다. loadPriceBook 이 통화에 맞춰 labelKo/labelJa 중 하나를
    // PriceEntry.label 에 채워 넣으므로 계산기·화면은 이 분리를 모른다.
    { name: 'labelKo', type: 'text', required: true },
    { name: 'labelJa', type: 'text', required: true },
    { name: 'category', type: 'number', required: true, index: true, min: 1, max: 5 },
    // 정수 최소단위. 환율 자동 변환은 하지 않는다 (대표님이 각각 입력)
    { name: 'priceKrw', type: 'number', required: true, min: 0 },
    { name: 'priceJpy', type: 'number', required: true, min: 0 },
    { name: 'active', type: 'checkbox', required: true, defaultValue: true },
  ],
}
