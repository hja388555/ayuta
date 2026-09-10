export type ContractFacts = {
  productName: string
  country: string
  channels: string
  amount: number
  currency: 'KRW' | 'JPY'
  contractDate: string
  buyerName: string
  signature: string
}

const SIGN: Record<ContractFacts['currency'], string> = { KRW: '₩', JPY: '¥' }

/**
 * 계약서 빈칸을 사실로 채운다.
 *
 * 치환은 **한 번만** 한다. 채운 값 안의 `{{...}}` 를 다시 치환하면 주문자 이름으로
 * 계약 금액을 바꿔치기할 수 있다.
 * 채우지 못한 빈칸은 지우지 않고 그대로 남긴 뒤 `missing` 으로 알린다 —
 * 빈 문자열로 지우면 구멍이 뚫린 계약서에 고객이 서명한다.
 */
export function fillContract(template: string, facts: ContractFacts): { text: string; missing: string[] } {
  const values: Record<string, string> = {
    productName: facts.productName,
    country: facts.country,
    channels: facts.channels,
    amount: `${SIGN[facts.currency]}${facts.amount.toLocaleString('en-US')}`,
    contractDate: facts.contractDate,
    buyerName: facts.buyerName,
    signature: facts.signature,
  }

  const missing: string[] = []
  const text = template.replace(/\{\{(\w+)\}\}/g, (whole, key: string) => {
    const value = values[key]
    if (value !== undefined) return value
    missing.push(key)
    return whole
  })
  return { text, missing }
}
