import { fillContract, type ContractFacts } from '@ayuta/pricing'

/**
 * 계약서 본문에 채울 수 없는 빈칸(`{{...}}`)을 찾는다(큐 Q25 2차).
 *
 * 관리자가 본문을 고치다 `{{amout}}` 처럼 오타를 내면 createOrder 가 그 빈칸을 missing 으로
 * 판정해 해당 카테고리 주문이 전부 막힌다. 저장 전에 걸러낸다.
 * 허용 목록을 따로 적지 않고 fillContract 에 모든 값을 채워 넣어 돌려 본다 — fillContract 가
 * 새 빈칸을 배우면 여기도 저절로 따라간다(목록이 두 군데면 언젠가 갈라진다).
 */
const EVERY_FACT: Required<ContractFacts> = {
  productName: 'x',
  country: 'x',
  channels: 'x',
  amount: 0,
  currency: 'KRW',
  contractDate: 'x',
  buyerName: 'x',
  signature: 'x',
  items: [],
  buyerRepresentative: 'x',
  buyerBusinessNo: 'x',
  buyerPhone: 'x',
  buyerContactPhone: 'x',
  buyerAddress: 'x',
  buyerEmail: 'x',
  companyName: 'x',
  companyCeo: 'x',
  companyRegNo: 'x',
  companyAddress: 'x',
  companyPhone: 'x',
  companyEmail: 'x',
}

export function unknownPlaceholders(body: string): string[] {
  return [...new Set(fillContract(body, EVERY_FACT).missing)]
}
