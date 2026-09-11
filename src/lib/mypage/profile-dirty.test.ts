import { describe, expect, it } from 'vitest'
import { isProfileDirty } from './profile-dirty'

const base = { name: '홍길동', phone: '010-1234-5678', postalCode: '12345', address1: '서울', address2: '', businessNo: '' }

describe('isProfileDirty', () => {
  it('같으면 false', () => {
    expect(isProfileDirty(base, { ...base })).toBe(false)
  })
  it('앞뒤 공백만 다르면 false', () => {
    expect(isProfileDirty(base, { ...base, name: ' 홍길동 ' })).toBe(false)
  })
  it('한 칸이라도 바뀌면 true', () => {
    expect(isProfileDirty(base, { ...base, address2: '101호' })).toBe(true)
  })
})
