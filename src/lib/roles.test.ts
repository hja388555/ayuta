import { describe, expect, it } from 'vitest'
import { canManageRoles, isAdminRole, isSuperRole, ROLES } from './roles'

describe('role 판정', () => {
  it('관리자 권한은 manager와 super뿐이다', () => {
    expect(isAdminRole('manager')).toBe(true)
    expect(isAdminRole('super')).toBe(true)
    expect(isAdminRole('customer')).toBe(false)
  })

  it('super만 최고 권한이다', () => {
    expect(isSuperRole('super')).toBe(true)
    expect(isSuperRole('manager')).toBe(false)
  })

  it('role 변경은 super만 할 수 있다', () => {
    expect(canManageRoles('super')).toBe(true)
    expect(canManageRoles('manager')).toBe(false)
    expect(canManageRoles('customer')).toBe(false)
  })

  it('알 수 없는 값은 모두 권한 없음으로 본다', () => {
    for (const bad of [undefined, null, '', 'admin', 'SUPER', 0, {}, ['super']]) {
      expect(isAdminRole(bad)).toBe(false)
      expect(isSuperRole(bad)).toBe(false)
      expect(canManageRoles(bad)).toBe(false)
    }
  })

  it('role 목록은 세 개뿐이다', () => {
    expect([...ROLES]).toEqual(['customer', 'manager', 'super'])
  })
})
