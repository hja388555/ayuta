import { describe, expect, it } from 'vitest'
import { fillContract } from '@ayuta/pricing'
import { BUYER_PLACEHOLDERS_PENDING, fillBuyerPreview } from './contract-preview'
import { categoryContractFacts } from './contract-items'
import { buyerContractFields } from './orderer'

const orderer = {
  name: '홍길동',
  phone: '010-1234-5678',
  email: 'hong@example.com',
  postalCode: '06236',
  address1: '서울 강남구 테헤란로 1',
  address2: '',
  businessNo: '',
  representative: '김대표',
}

const TEMPLATE = [
  '선택 상품: {{productName}} / 채널: {{channels}} / 국가: {{country}}',
  '{{items}}',
  '금액 {{amount}} · {{contractDate}}',
  '갑 {{buyerName}} 대표 {{buyerRepresentative}} 사업자 {{buyerBusinessNo}}',
  '전화 {{buyerPhone}} 담당 {{buyerContactPhone}} 주소 {{buyerAddress}} 메일 {{buyerEmail}}',
  '서명 {{signature}}',
].join('\n')

const baseFacts = () => {
  const items = [
    { label: '등급', value: '스탠다드' },
    { label: '플랫폼', value: '유튜브' },
  ]
  return {
    amount: 2_000_000,
    currency: 'KRW' as const,
    contractDate: '2026년 9월 12일',
    items,
    ...categoryContractFacts(items, { country: ['kr', 'jp'] }, 'ko'),
  }
}

describe('결제 화면 계약서 미리보기', () => {
  it('서버가 채운 뒤 화면이 주문자 칸을 채우면 주문에 저장될 전문과 글자가 같다', () => {
    const server = fillContract(TEMPLATE, { ...baseFacts(), ...BUYER_PLACEHOLDERS_PENDING })
    const preview = fillBuyerPreview(server.text, orderer, '홍길동')

    const stored = fillContract(TEMPLATE, {
      ...baseFacts(),
      buyerName: orderer.name,
      signature: '홍길동',
      ...buyerContractFields({ ...orderer, address2: undefined, businessNo: undefined }),
    })
    expect(stored.missing).toEqual([])
    expect(preview).toBe(stored.text)
    expect(preview).not.toContain('{{')
  })

  it('선택 상품·채널·국가는 서버 단계에서 이미 채워진다', () => {
    const server = fillContract(TEMPLATE, { ...baseFacts(), ...BUYER_PLACEHOLDERS_PENDING })
    expect(server.text).toContain('선택 상품: 스탠다드 / 채널: 유튜브 / 국가: 한국, 일본')
    expect(server.missing.sort()).toEqual(['buyerAddress', 'buyerBusinessNo', 'buyerContactPhone', 'buyerEmail', 'buyerPhone', 'buyerRepresentative'])
  })

  it('플랫폼을 안 골랐으면 채널은 대시다', () => {
    expect(categoryContractFacts([{ label: '등급', value: '베이직' }], { country: ['kr'] }, 'ko')).toEqual({ productName: '베이직', channels: '-', country: '한국' })
  })

  it('아직 서명 전이거나 모르는 칸은 원문 {{…}} 대신 — 로 보인다', () => {
    const text = fillBuyerPreview('서명 {{signature}} / {{unknownKey}} / 대표 {{buyerRepresentative}}', { ...orderer, representative: '' }, '')
    expect(text).toBe('서명 — / — / 대표 -')
  })

  it('주문자가 입력한 {{…}} 는 다시 치환되지 않는다', () => {
    expect(fillBuyerPreview('{{buyerName}} {{buyerEmail}}', { ...orderer, name: '{{buyerEmail}}' }, '')).toBe('{{buyerEmail}} hong@example.com')
  })
})
