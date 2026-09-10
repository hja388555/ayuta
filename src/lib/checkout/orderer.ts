import { z } from 'zod'

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
  phone: trimmedRequired(30),
  email: z.string().trim().min(1).max(200).email(),
  postalCode: trimmedRequired(20),
  address1: trimmedRequired(200),
  // 상세주소는 없어도 된다. 다만 보냈다면 길이 상한은 지킨다
  address2: z.string().trim().max(200).optional(),
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
