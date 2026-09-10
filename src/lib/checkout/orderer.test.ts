import { describe, expect, it } from 'vitest'
import { buyerContractFields, OrdererSchema } from './orderer'

const valid = {
  name: '홍길동',
  phone: '010-1234-5678',
  email: 'hong@example.com',
  postalCode: '12345',
  address1: '서울특별시 동대문구 답십리동 323',
}

describe('주문자 정보', () => {
  it('이름·연락처·이메일·우편번호·기본주소가 없으면 거부한다', () => {
    for (const key of ['name', 'phone', 'email', 'postalCode', 'address1'] as const) {
      const { [key]: _omit, ...rest } = valid
      expect(OrdererSchema.safeParse(rest).success).toBe(false)
    }
  })

  it('상세주소는 없어도 된다', () => {
    const result = OrdererSchema.safeParse(valid)
    expect(result.success).toBe(true)
  })

  it('이메일 형식을 검증한다', () => {
    expect(OrdererSchema.safeParse({ ...valid, email: '이메일아님' }).success).toBe(false)
  })

  it('앞뒤 공백을 제거한 뒤 검증한다 — 공백만 넣은 이름을 통과시키지 않는다', () => {
    expect(OrdererSchema.safeParse({ ...valid, name: '   ' }).success).toBe(false)

    const trimmed = OrdererSchema.safeParse({ ...valid, name: '  홍길동  ' })
    expect(trimmed.success).toBe(true)
    if (trimmed.success) expect(trimmed.data.name).toBe('홍길동')
  })

  it('지나치게 긴 입력을 거부한다', () => {
    expect(OrdererSchema.safeParse({ ...valid, name: 'a'.repeat(101) }).success).toBe(false)
    expect(OrdererSchema.safeParse({ ...valid, address1: 'a'.repeat(201) }).success).toBe(false)
  })

  it('사업자등록번호는 선택이고, 넣으면 형식을 본다', () => {
    expect(OrdererSchema.safeParse(valid).success).toBe(true)
    expect(OrdererSchema.safeParse({ ...valid, businessNo: '259-23-02007' }).success).toBe(true)
    expect(OrdererSchema.safeParse({ ...valid, businessNo: '2592302007' }).success).toBe(false)
    expect(OrdererSchema.safeParse({ ...valid, businessNo: '아무값' }).success).toBe(false)
  })
})

describe('계약서 갑측 부가 정보', () => {
  it('사업자등록번호가 없으면 빈 줄이 아니라 해당 없음으로 표시한다', () => {
    const fields = buyerContractFields(valid)
    expect(fields.buyerBusinessNo).toBe('-')
    // 대표자를 안 보내면(개인 고객) 해당 없음이다
    expect(fields.buyerRepresentative).toBe('-')
  })

  it('대표자를 보내면 그대로 쓴다', () => {
    const fields = buyerContractFields({ ...valid, representative: '김대표' })
    expect(fields.buyerRepresentative).toBe('김대표')
  })

  it('사업자등록번호가 있으면 그대로 쓴다', () => {
    const fields = buyerContractFields({ ...valid, businessNo: '259-23-02007' })
    expect(fields.buyerBusinessNo).toBe('259-23-02007')
  })

  it('담당자 연락처는 따로 받지 않으므로 전화번호와 같다', () => {
    const fields = buyerContractFields(valid)
    expect(fields.buyerContactPhone).toBe(valid.phone)
  })

  it('주소는 우편번호·기본주소·상세주소를 이어 붙인다', () => {
    const fields = buyerContractFields({ ...valid, address2: '5층' })
    expect(fields.buyerAddress).toBe(`${valid.postalCode} ${valid.address1} 5층`)
  })

  it('상세주소가 없으면 우편번호·기본주소만 이어 붙인다', () => {
    const fields = buyerContractFields(valid)
    expect(fields.buyerAddress).toBe(`${valid.postalCode} ${valid.address1}`)
  })
})
