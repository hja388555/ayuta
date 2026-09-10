import { describe, expect, it } from 'vitest'
import { EMPTY_ORDERER, autoSignature, canSubmit, type OrdererFormState } from './CheckoutForm'
import type { ConsentDef } from '@/lib/checkout/consents'

const orderer: OrdererFormState = {
  ...EMPTY_ORDERER,
  name: '홍길동',
  phone: '010-1234-5678',
  email: 'hong@example.com',
  postalCode: '12345',
  address1: '서울특별시 동대문구 답십리동 323',
}

const oneConsent: ConsentDef[] = [{ key: 'agree', label: '동의', required: true }]
const threeConsents: ConsentDef[] = [
  { key: 'terms', label: '이용약관', required: true },
  { key: 'privacy', label: '개인정보', required: true },
  { key: 'contract', label: '계약내용', required: true },
]

describe('전자서명 자동 기입', () => {
  it('필수 동의가 전부 체크되면 이름이 서명으로 채워진다', () => {
    expect(autoSignature(orderer, oneConsent, { agree: true })).toBe('홍길동')
  })

  it('필수 동의 중 하나라도 안 채워지면 서명은 빈 문자열이다', () => {
    expect(autoSignature(orderer, threeConsents, { terms: true, privacy: true })).toBe('')
  })

  it('동의가 없는 카테고리(빈 배열)는 항상 서명이 채워진다', () => {
    expect(autoSignature(orderer, [], {})).toBe('홍길동')
  })
})

describe('결제 가능 여부', () => {
  it('주문자 정보와 서명이 모두 채워지고 필수 동의가 끝나면 결제할 수 있다', () => {
    const signature = autoSignature(orderer, oneConsent, { agree: true })
    expect(canSubmit(orderer, oneConsent, { agree: true }, signature)).toBe(true)
  })

  it('필수 동의가 하나라도 빠지면 결제할 수 없다', () => {
    expect(canSubmit(orderer, oneConsent, {}, '')).toBe(false)
  })

  it('이름이 비어 있으면 동의를 다 체크해도 결제할 수 없다', () => {
    const empty = { ...orderer, name: '' }
    const signature = autoSignature(empty, oneConsent, { agree: true })
    expect(canSubmit(empty, oneConsent, { agree: true }, signature)).toBe(false)
  })

  it('정의에 없는 키를 체크해도 필수 동의를 대신하지 못한다', () => {
    expect(canSubmit(orderer, oneConsent, { madeUpKey: true }, '홍길동')).toBe(false)
  })
})
