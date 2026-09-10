import type { GlobalConfig } from 'payload'
import { isActiveAdmin, isActiveSuper } from '../lib/admin-access'
import { COMPANY_JA, COMPANY_KO } from '../lib/company'

/**
 * 을(아유타) 회사 정보와 사업자정보 푸터 값(큐 Q25). 계약서·견적서·푸터가 모두 여기서 읽는다
 * (src/lib/company.ts loadCompany). 코드 상수(COMPANY_KO/JA)는 기본값으로만 남는다 — 설정에서
 * 한 번 바꾸면 그 뒤로는 DB 값을 쓴다.
 *
 * 계약서 스냅샷은 주문 시점에 값으로 복사되므로, 여기서 대표전화를 바꿔도 이미 체결된 계약서는
 * 바뀌지 않는다(바뀌어서도 안 된다).
 * 담당자 연락처·통신판매업 신고번호는 아직 미수령이라 비워 둔다 — 비어 있으면 푸터에서 빠진다.
 */
export const CompanySettings: GlobalConfig = {
  slug: 'company-settings',
  access: {
    read: ({ req }) => isActiveAdmin(req),
    update: ({ req }) => isActiveSuper(req),
  },
  fields: [
    { name: 'nameKo', type: 'text', required: true, defaultValue: COMPANY_KO.name },
    { name: 'nameJa', type: 'text', required: true, defaultValue: COMPANY_JA.name },
    { name: 'ceo', type: 'text', required: true, defaultValue: COMPANY_KO.ceo },
    { name: 'businessNo', type: 'text', required: true, defaultValue: COMPANY_KO.businessNo },
    { name: 'addressKo', type: 'text', required: true, defaultValue: COMPANY_KO.address },
    { name: 'addressJa', type: 'text', required: true, defaultValue: COMPANY_JA.address },
    { name: 'phone', type: 'text', required: true, defaultValue: COMPANY_KO.phone },
    { name: 'email', type: 'email', required: true, defaultValue: COMPANY_KO.email },
    { name: 'contactPhone', type: 'text' },
    { name: 'mailOrderNo', type: 'text' },
    { name: 'sealImage', type: 'upload', relationTo: 'brand-assets' },
  ],
}
