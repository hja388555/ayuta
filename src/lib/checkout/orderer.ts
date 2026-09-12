import { z } from 'zod'
import { formatPhoneForContract, normalizePhoneInput, PHONE_MAX, phoneCountryForLocale } from '../phone'

// 회원·비회원 공용 주문자 정보. 회원도 세션을 신뢰하지 않고 이 스키마로 다시 검증한다 —
// 비회원은 애초에 세션이 없으므로 검증 통로가 이것 하나뿐이다 (G2-5).
//
// 앞뒤 공백만 있는 입력(예: 이름칸에 스페이스 세 개)을 걸러야 한다. z.string().trim()은
// trim 결과에 min()을 적용하므로 공백만 넣은 값은 길이 0으로 걸린다.
const trimmedRequired = (max: number) => z.string().trim().min(1).max(max)

// 사업자등록번호: XXX-XX-XXXXX (10자리, 하이픈 포함 12자). 개인 고객은 아예 안 보낼 수 있으므로
// 필드 자체는 선택이지만, 값이 있으면(빈 문자열이 아니면) 형식을 반드시 지켜야 한다 —
// 형식을 안 보면 계약서 을/갑 정보란에 아무 문자열이나 그대로 찍힌다.
const businessNoPattern = /^\d{3}-\d{2}-\d{5}$/

export const OrdererSchema = z.object({
  name: trimmedRequired(100),
  phone: trimmedRequired(PHONE_MAX),
  email: z.string().trim().min(1).max(200).email(),
  postalCode: trimmedRequired(20),
  address1: trimmedRequired(200),
  // 상세주소는 없어도 된다. 다만 보냈다면 길이 상한은 지킨다
  address2: z.string().trim().max(200).optional(),
  // 대표자(법인 고객의 대표자 성명). 개인 고객은 해당이 없으므로 선택이다 — 값이 없으면
  // 계약서에는 "-"를 찍는다. 4번 계약서는 대표자를 자동 채움 항목으로 명시한다
  representative: z.string().trim().max(100).optional(),
  businessNo: z
    .string()
    .trim()
    .max(20)
    .optional()
    .refine((v) => !v || businessNoPattern.test(v), {
      message: '사업자등록번호 형식이 올바르지 않습니다 (예: 259-23-02007)',
    }),
})

export type Orderer = z.infer<typeof OrdererSchema>

/**
 * 주문 입력 스키마의 transform — 주문자 연락처를 E.164 로 바꿔 저장·계약서·본인 확인이 같은 값을 쓰게 한다.
 * 국가번호 없이 온 값은 주문 언어의 나라를 먼저, 다음 다른 나라 규칙으로 본다(화면은 늘 국가번호를 붙여 보낸다).
 */
export function normalizeOrdererPhone<T extends { locale: 'ko' | 'ja'; orderer: Orderer }>(d: T, ctx: z.RefinementCtx): T {
  const phone = normalizePhoneInput(d.orderer.phone, phoneCountryForLocale(d.locale))
  if (!phone) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['orderer', 'phone'], message: 'invalid_phone' })
    return z.NEVER
  }
  return { ...d, orderer: { ...d.orderer, phone } }
}

const NOT_APPLICABLE = '-'

/**
 * 계약서 갑(고객)측 부가 정보를 주문자 정보에서 채운다.
 *
 * "대표자 성명"은 이제 Orderer 스키마가 선택으로 받는다 — 개인 고객은 원래 해당이
 * 없어 비워 두면 되고, 법인 고객은 넣을 자리가 생겼다. 값이 없는 "선택이고 값이 없는"
 * 항목은 빈칸으로 남기지 않고 명시적으로 "해당 없음"을 찍는다 — 인쇄된 계약서의 빈 줄은
 * 나중에 누군가 손으로 채워 넣으라는 초대장이 된다.
 */
export function buyerContractFields(orderer: Orderer): {
  buyerRepresentative: string
  buyerBusinessNo: string
  buyerPhone: string
  buyerContactPhone: string
  buyerAddress: string
  buyerEmail: string
} {
  return {
    buyerRepresentative: orderer.representative || NOT_APPLICABLE,
    buyerBusinessNo: orderer.businessNo || NOT_APPLICABLE,
    // 한국 번호는 010-1234-5678, 일본 번호는 +81 90-1234-5678 (lib/phone formatPhoneForContract)
    buyerPhone: formatPhoneForContract(orderer.phone),
    // 담당자 연락처를 따로 받지 않으므로 전화번호와 동일하게 처리한다
    // (docs/법무문서-확정본.md C절 — "미입력 시 전화번호와 동일 처리")
    buyerContactPhone: formatPhoneForContract(orderer.phone),
    buyerAddress: [orderer.postalCode, orderer.address1, orderer.address2].filter(Boolean).join(' '),
    buyerEmail: orderer.email,
  }
}
