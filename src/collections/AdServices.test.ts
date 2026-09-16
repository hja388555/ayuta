import { describe, expect, it } from 'vitest'
import { AdServices } from './AdServices'
import { AdServiceGroups } from './AdServiceGroups'

type Field = { name?: string; options?: string[]; access?: { update?: () => boolean } }
const field = (c: { fields: unknown[] }, name: string) => (c.fields as Field[]).find((f) => f.name === name)!

describe('ad-services 컬렉션', () => {
  it('번호·주소는 만든 뒤 못 바꾼다', () => {
    expect(field(AdServices, 'no').access?.update?.()).toBe(false)
    expect(field(AdServices, 'slug').access?.update?.()).toBe(false)
  })

  it('삭제는 막고 읽기는 공개다', () => {
    expect(AdServices.access?.delete?.({} as never)).toBe(false)
    expect(AdServices.access?.read?.({} as never)).toBe(true)
  })

  it('계산 방식과 계약서 방식은 정해진 값만 받는다', () => {
    expect(field(AdServices, 'model').options).toEqual(['tier', 'sum', 'sumMultiplier', 'videoPairs', 'inquiry'])
    expect(field(AdServices, 'contractMode').options).toEqual(['fixed', 'perQuote'])
  })
})

describe('ad-service-groups 컬렉션', () => {
  it('묶음 키는 만든 뒤 못 바꾼다', () => {
    expect(field(AdServiceGroups, 'key').access?.update?.()).toBe(false)
  })

  it('영상 종류·길이 축은 정해진 값만 받는다', () => {
    expect(field(AdServiceGroups, 'axis').options).toEqual(['none', 'type', 'length'])
  })

  it('삭제는 막는다', () => {
    expect(AdServiceGroups.access?.delete?.({} as never)).toBe(false)
  })
})
