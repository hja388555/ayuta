import { describe, expect, it } from 'vitest'
import { EMPTY_ORDERER, canSubmit, initialOrdererState, signatureReady, validateOrderer, type OrdererFormState } from './CheckoutForm'
import type { ConsentDef } from '@/lib/checkout/consents'

const orderer: OrdererFormState = {
  ...EMPTY_ORDERER,
  name: '홍길동',
  phone: '010-1234-5678',
  email: 'hong@example.com',
  postalCode: '12345',
  address1: '서울특별시 동대문구 답십리동 323',
  representative: '홍길동',
}

const oneConsent: ConsentDef[] = [{ key: 'agree', label: '동의', required: true }]

describe('서명 입력 확인', () => {
  it('비어 있으면 서명이 준비되지 않는다', () => {
    expect(signatureReady('', '홍길동')).toBe(false)
  })

  it('앞뒤 공백은 무시하고 주문자명과 같으면 서명이 준비된다', () => {
    expect(signatureReady('홍길동 ', '홍길동')).toBe(true)
  })

  it('주문자명과 다르면 서명이 준비되지 않는다', () => {
    expect(signatureReady('홍길둥', '홍길동')).toBe(false)
  })
})

describe('주문자 칸 검증', () => {
  it('모두 올바르면 오류가 없다', () => {
    expect(validateOrderer(orderer)).toEqual({})
  })

  it('비어 있는 필수 칸은 required 로 표시한다(대표자 성명 포함)', () => {
    expect(validateOrderer({ ...orderer, postalCode: ' ', representative: '' })).toEqual({ postalCode: 'required', representative: 'required' })
  })

  it('이메일 형식이 틀리면 email 오류다', () => {
    expect(validateOrderer({ ...orderer, email: 'name@' })).toEqual({ email: 'email' })
  })

  it('연락처는 고른 나라의 번호 규칙을 따른다', () => {
    expect(validateOrderer({ ...orderer, phone: '010-0' })).toEqual({ phone: 'phone' })
    expect(validateOrderer({ ...orderer, phone: '+81 90-1234-5678' })).toEqual({})
    expect(validateOrderer({ ...orderer, phoneCountry: 'JP', phone: '090-1234-5678' })).toEqual({})
    expect(validateOrderer({ ...orderer, phoneCountry: 'JP', phone: '010-1234-5678' })).toEqual({ phone: 'phone' })
    expect(validateOrderer({ ...orderer, phoneCountry: 'KR', phone: '090-1234-5678' })).toEqual({ phone: 'phone' })
  })
})

describe('주문자 칸 처음 상태', () => {
  it('저장된 E.164 연락처는 나라와 입력칸 숫자로 푼다', () => {
    // 칸에는 국가번호와 앞자리 0 을 뺀 숫자만 들어간다(나라는 왼쪽 선택칸이 보여 준다)
    expect(initialOrdererState({ phone: '+819012345678' }, ['kr'], 'ko')).toMatchObject({ phone: '9012345678', phoneCountry: 'JP' })
  })
  it('연락처가 없으면 표지 국가 하나 > 언어로 나라를 정한다', () => {
    expect(initialOrdererState(undefined, ['jp'], 'ko').phoneCountry).toBe('JP')
    expect(initialOrdererState(undefined, ['jp', 'kr'], 'ko').phoneCountry).toBe('KR')
    expect(initialOrdererState(undefined, [], 'ja').phoneCountry).toBe('JP')
  })
  it('예전 형식 저장값은 그대로 둔다', () => {
    expect(initialOrdererState({ phone: '010-1234-5678' }, [], 'ko')).toMatchObject({ phone: '010-1234-5678', phoneCountry: 'KR' })
  })

  it('상세 주소·사업자등록번호는 비워도 된다', () => {
    expect(validateOrderer({ ...orderer, address2: '', businessNo: '' })).toEqual({})
  })
})

describe('결제 가능 여부', () => {
  it('주문자 정보와 서명이 모두 채워지고 필수 동의가 끝나면 결제할 수 있다', () => {
    expect(canSubmit(orderer, oneConsent, { agree: true }, '홍길동')).toBe(true)
  })

  it('필수 동의가 하나라도 빠지면 결제할 수 없다', () => {
    expect(canSubmit(orderer, oneConsent, {}, '홍길동')).toBe(false)
  })

  it('서명이 비어 있으면 동의를 다 체크해도 결제할 수 없다', () => {
    expect(canSubmit(orderer, oneConsent, { agree: true }, '')).toBe(false)
  })

  it('서명이 주문자명과 다르면 동의를 다 체크해도 결제할 수 없다', () => {
    expect(canSubmit(orderer, oneConsent, { agree: true }, '홍길둥')).toBe(false)
  })

  it('이름이 비어 있으면 동의를 다 체크해도 결제할 수 없다', () => {
    const empty = { ...orderer, name: '' }
    expect(canSubmit(empty, oneConsent, { agree: true }, '')).toBe(false)
  })

  it('이메일 형식이 틀리면 동의를 다 체크해도 결제할 수 없다', () => {
    const bad = { ...orderer, email: 'name@' }
    expect(canSubmit(bad, oneConsent, { agree: true }, '홍길동')).toBe(false)
  })

  it('정의에 없는 키를 체크해도 필수 동의를 대신하지 못한다', () => {
    expect(canSubmit(orderer, oneConsent, { madeUpKey: true }, '홍길동')).toBe(false)
  })
})
