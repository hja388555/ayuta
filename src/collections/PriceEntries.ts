import type { CollectionConfig, NumberFieldSingleValidation } from 'payload'
import { number } from 'payload/shared'
import { isAdminRole } from '../lib/roles'
import { isVerifiedSuper } from '../lib/admin-access'

// 금액은 정수 최소단위다. src/lib/price-book.ts 의 minor() 가 소수·음수를 런타임에 던지는데,
// 그 시점은 이미 고객이 견적을 요청한 뒤라 화면이 통째로 500 이 된다. 입력에서 막는다.
//
// 커스텀 validate 를 달면 Payload 의 기본 number 검증(required · min)이 통째로 빠진다.
// 그래서 REST 로 빈 문자열("")을 보내면 null 이 이 검증을 통과해 NOT NULL 컬럼에서
// 500 이 났다. 기본 검증을 먼저 돌리고 그 위에 정수 조건만 얹는다.
const validateMinorAmount: NumberFieldSingleValidation = (value, options) => {
  const base = number(value, options)
  if (base !== true) return base
  if (value === null || value === undefined) return true // required 가 아닌 경우만 여기 온다
  if (!Number.isInteger(value)) return '금액은 소수점 없는 정수여야 합니다.'
  if (value < 0) return '금액은 0 이상이어야 합니다.'
  return true
}

export const PriceEntries: CollectionConfig = {
  slug: 'price-entries',
  admin: {
    useAsTitle: 'labelKo',
    // 카테고리 컬럼을 목록 필터로 쓰면 별도 탭 UI 없이 카테고리별 단가 관리가 된다.
    defaultColumns: ['category', 'key', 'labelKo', 'priceKrw', 'priceJpy', 'active'],
    listSearchableFields: ['key', 'labelKo', 'labelJa'],
    // 전 카테고리 단가가 100건대라 한 페이지에 다 보이게 한다 (페이지 넘기며 비교할 일이 없다).
    pagination: { defaultLimit: 200 },
  },
  access: {
    // 단가는 견적 화면에 그대로 나가므로 읽기는 공개
    read: () => true,
    // 단가 변경은 곧 매출 변경이다. 최고관리자만, 그리고 2단계 인증까지 — role 만 보면
    // OTP 를 거치지 않은 super 세션이 REST(PATCH /api/price-entries/:id)로 단가를 바꾼다.
    // 시드 스크립트는 overrideAccess 로 돌아 이 제한에 걸리지 않는다
    create: ({ req }) => isVerifiedSuper(req),
    update: ({ req }) => isVerifiedSuper(req),
    delete: ({ req }) => isVerifiedSuper(req),
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
      // 키는 만들 때만 정하고 그 뒤로는 못 바꾼다. 계산기(packages/pricing)는
      // category-groups.ts 의 항목 key 로 PriceBook 을 조회하고, scripts/seed-prices.ts 도
      // key 로 기존 행을 찾는다 — 관리자가 key 를 한 글자만 고쳐도 에러 없이 "단가 없음"이
      // 되어 견적이 통째로 거부되거나 시드가 중복 행을 새로 만든다. 조용한 실패라 더 위험하다.
      // admin.readOnly 는 생성 화면까지 잠그므로 필드 access.update 로 수정만 막는다.
      // (scripts/seed-prices.ts 는 overrideAccess: true 로 돌기 때문에 이 제한에 걸리지 않는다.)
      access: { update: () => false },
      admin: {
        description: '생성 후에는 변경할 수 없습니다. 계산기·시드 스크립트가 이 키로 단가를 찾습니다.',
      },
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
    { name: 'priceKrw', type: 'number', required: true, min: 0, validate: validateMinorAmount },
    { name: 'priceJpy', type: 'number', required: true, min: 0, validate: validateMinorAmount },
    { name: 'active', type: 'checkbox', required: true, defaultValue: true },
  ],
}
