export type ContractFacts = {
  // 1번 계약서만 쓰는 고정 필드다. 2·4번은 이 값들 없이 items 만으로 채운다 — 그래서
  // 선택으로 둔다. 값이 없으면 (템플릿이 그 키를 쓸 경우) missing 으로 보고된다.
  productName?: string
  country?: string
  channels?: string
  amount: number
  currency: 'KRW' | 'JPY'
  contractDate: string
  buyerName: string
  signature: string
  // 계약서마다 빈칸 구성이 다르다(1번: 상품·국가·채널 / 2번: 촬영국가·영상종류·영상길이·옵션 /
  // 4번: 노선·위치·사이즈·기간). 고정 키로 두면 새 계약서가 올 때마다 이 타입을 또 깨야 한다.
  // 그래서 카테고리별 항목은 라벨·값 쌍의 목록으로 받아 {{items}} 자리에 한 번에 펼친다.
  items: { label: string; value: string }[]
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
  const values: Record<string, string | undefined> = {
    productName: facts.productName,
    country: facts.country,
    channels: facts.channels,
    amount: `${SIGN[facts.currency]}${facts.amount.toLocaleString('en-US')}`,
    contractDate: facts.contractDate,
    buyerName: facts.buyerName,
    signature: facts.signature,
    // 항목을 먼저 한 번에 텍스트로 펼쳐 values 에 넣는다. replace 콜백의 반환값은
    // 정규식이 다시 훑지 않으므로(String.replace 는 원본 문자열만 한 번 스캔한다)
    // 항목 값 안에 {{amount}} 같은 치환 문법이 있어도 재귀 치환되지 않는다.
    items: facts.items.map((item) => `${item.label}: ${item.value}`).join('\n'),
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
