import { describe, expect, it } from 'vitest'
import { INQUIRY_FIELDS, fileError, validateInquiry } from './InquiryForm'

const ok = { country: ['kr'], body: '문의', name: '홍길동', phone: '010-1234-5678', phoneCountry: 'KR' as const, email: 'hong@example.com', consent: true }

describe('5번 문의 폼 칸 검증', () => {
  it('모두 올바르면 오류가 없다', () => {
    expect(validateInquiry(ok)).toEqual({})
  })

  it('빈 폼은 화면 순서대로 모든 필수 칸을 표시한다 — 첫 오류는 국가', () => {
    const errors = validateInquiry({ country: [], body: ' ', name: '', phone: '', phoneCountry: 'KR', email: '', consent: false })
    expect(errors).toEqual({
      country: 'country_required',
      body: 'field_required',
      name: 'field_required',
      phone: 'field_required',
      email: 'field_required',
      consent: 'consent_required',
    })
    expect(INQUIRY_FIELDS.find((f) => errors[f])).toBe('country')
  })

  it('이메일·연락처 형식을 본다', () => {
    expect(validateInquiry({ ...ok, email: 'name@' })).toEqual({ email: 'email' })
    expect(validateInquiry({ ...ok, phone: '010-12' })).toEqual({ phone: 'phone' })
    expect(validateInquiry({ ...ok, phone: '+81 90-1234-5678' })).toEqual({})
    expect(validateInquiry({ ...ok, phone: '090-1234-5678' })).toEqual({ phone: 'phone' })
    expect(validateInquiry({ ...ok, phoneCountry: 'JP', phone: '090-1234-5678' })).toEqual({})
  })
})

describe('5번 문의 첨부 확인', () => {
  const f = (name: string, type: string, size = 10) => ({ name, type, size })

  it('JPG·PNG·WEBP·PDF 만 받는다', () => {
    expect(fileError([f('a.jpg', 'image/jpeg'), f('b.PNG', 'image/png'), f('c.webp', 'image/webp'), f('d.pdf', 'application/pdf')])).toBeNull()
    expect(fileError([f('fake.pdf.exe', 'application/x-msdownload')])).toBe('invalid_file')
    expect(fileError([f('note.txt', 'text/plain')])).toBe('invalid_file')
    expect(fileError([f('icon.svg', 'image/svg+xml')])).toBe('invalid_file')
  })

  it('형식을 모르는 파일은 확장자로 본다', () => {
    expect(fileError([f('scan.pdf', '')])).toBeNull()
    expect(fileError([f('fake.pdf.exe', '')])).toBe('invalid_file')
  })

  it('개수·합계 크기 상한', () => {
    expect(fileError(Array.from({ length: 6 }, (_, i) => f(`${i}.png`, 'image/png')))).toBe('too_many_files')
    expect(fileError([f('big.png', 'image/png', 5 * 1024 * 1024)])).toBe('too_large')
  })
})
