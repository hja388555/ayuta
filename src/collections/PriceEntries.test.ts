import { describe, expect, it } from 'vitest'
import type { Field } from 'payload'
import { PriceEntries } from './PriceEntries'

const fieldBy = (name: string): Field & { name: string } => {
  const field = PriceEntries.fields.find((f) => 'name' in f && f.name === name)
  if (!field) throw new Error(`필드가 없습니다: ${name}`)
  return field as Field & { name: string }
}

// validate 는 (value, options) 시그니처라 테스트에서는 두 번째 인자를 쓰지 않는다
const runValidate = (name: string, value: unknown) => {
  const field = fieldBy(name) as { validate?: (v: unknown, o: unknown) => unknown }
  if (!field.validate) throw new Error(`${name} 에 validate 가 없습니다`)
  return field.validate(value, {})
}

describe('단가 관리 화면 설정', () => {
  it('목록 제목으로 한국어 라벨을 쓴다', () => {
    expect(PriceEntries.admin?.useAsTitle).toBe('labelKo')
  })

  it('카테고리를 첫 컬럼으로 둬서 컬럼 필터가 탭 역할을 하게 한다', () => {
    expect(PriceEntries.admin?.defaultColumns).toEqual([
      'category',
      'key',
      'labelKo',
      'priceKrw',
      'priceJpy',
      'active',
    ])
  })

  it('키와 두 언어 라벨로 검색할 수 있다', () => {
    expect(PriceEntries.admin?.listSearchableFields).toEqual(['key', 'labelKo', 'labelJa'])
  })

  it('한 페이지에 200건까지 보여준다', () => {
    expect(PriceEntries.admin?.pagination?.defaultLimit).toBe(200)
  })
})

describe('key 변경 금지', () => {
  it('수정은 막는다 — 키가 바뀌면 계산기·시드가 조용히 단가를 못 찾는다', () => {
    const access = (fieldBy('key') as { access?: { update?: (a: unknown) => boolean } }).access
    expect(access?.update?.({})).toBe(false)
  })

  it('생성은 막지 않는다 (create 접근 제한이 없어 컬렉션 access 만 적용된다)', () => {
    const access = (fieldBy('key') as { access?: { create?: unknown } }).access
    expect(access?.create).toBeUndefined()
  })

  it('admin.readOnly 로 잠그지 않는다 — 생성 화면까지 막히기 때문', () => {
    const admin = (fieldBy('key') as { admin?: { readOnly?: boolean; description?: string } }).admin
    expect(admin?.readOnly).toBeUndefined()
    expect(admin?.description).toContain('생성 후에는 변경할 수 없습니다')
  })
})

describe.each(['priceKrw', 'priceJpy'])('%s 금액 검증', (name) => {
  it('정수를 통과시킨다', () => {
    expect(runValidate(name, 1_000_000)).toBe(true)
    expect(runValidate(name, 0)).toBe(true)
  })

  it('소수를 거부한다 — minor() 가 런타임에 던지기 전에 막는다', () => {
    expect(runValidate(name, 1000.5)).toBe('금액은 소수점 없는 정수여야 합니다.')
  })

  it('음수를 거부한다', () => {
    expect(runValidate(name, -1)).toBe('금액은 0 이상이어야 합니다.')
  })
})
