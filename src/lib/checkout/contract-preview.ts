// 화면(CheckoutForm)도 이 파일을 쓴다 — messages 전체를 읽는 contract-items.ts 는 가져오지 않는다
import { buyerContractFields } from './orderer'

/**
 * 서버 미리보기에서 주문자 칸을 **채우지 않고** 자리표시자 그대로 남기는 값.
 * fillContract 는 채운 값을 다시 훑지 않으므로 "{{buyerName}}" 이 그대로 남는다 —
 * 화면이 입력 중인 주문자 정보로 fillBuyerPreview 에서 채운다.
 */
export const BUYER_PLACEHOLDERS_PENDING = { buyerName: '{{buyerName}}', signature: '{{signature}}' } as const

export type PreviewOrderer = {
  name: string
  phone: string
  email: string
  postalCode: string
  address1: string
  address2?: string
  businessNo?: string
  representative?: string
}

const EMPTY_MARK = '—'

/**
 * 서버가 주문자 칸만 남기고 채운 미리보기 전문에, 화면에 입력 중인 주문자 값을 넣는다.
 * 주문 생성(persistOrder)과 같은 buyerContractFields 로 채워 저장될 전문과 글자가 같다.
 * 아직 비어 있는 값·알 수 없는 칸은 원문 {{…}} 대신 "—" 로 보인다. 치환은 한 번만 한다 —
 * 주문자가 입력한 값 안의 {{…}} 가 다시 치환되지 않는다.
 */
export function fillBuyerPreview(text: string, orderer: PreviewOrderer, signature: string): string {
  const buyer = buyerContractFields({
    ...orderer,
    address2: orderer.address2 || undefined,
    businessNo: orderer.businessNo || undefined,
    representative: orderer.representative || undefined,
  })
  const values: Record<string, string> = { ...buyer, buyerName: orderer.name, signature }
  return text.replace(/\{\{(\w+)\}\}/g, (_whole, key: string) => values[key]?.trim() || EMPTY_MARK)
}
