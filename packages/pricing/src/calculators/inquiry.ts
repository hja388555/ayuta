import type { QuoteResult } from '../types/index'

/**
 * 5번은 금액이 정해지지 않은 문의다.
 * 성공을 돌려주면 금액 0 원 주문이 만들어지므로, 항상 "견적 발행이 필요하다"로 답한다.
 */
export function calculateInquiry(): QuoteResult {
  return { ok: false, errors: [{ field: 'category', message: '관리자 견적 발행이 필요한 항목입니다.' }] }
}
