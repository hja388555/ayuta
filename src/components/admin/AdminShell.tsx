import type { ReactNode } from 'react'
import type { Role } from '@/lib/roles'
import { AdminBfcacheGuard, AdminLogoutButton, AdminNav } from './AdminNav'
import s from './AdminShell.module.css'

const ROLE_LABEL: Record<Role, string> = { super: '최고관리자', manager: '중간관리자', customer: '고객' }

/**
 * 관리자 공용 셸(Figma [v2] A2 228:34 · 228:185) — 검은 상단바 + 좌측 메뉴(모바일은 칩 메뉴).
 * 권한 게이트는 여기서 하지 않는다. (gated)/layout.tsx 가 requireAdmin 을 통과시킨 뒤에만 렌더한다.
 */
export function AdminShell({ user, children }: { user: { email: string; role: Role }; children: ReactNode }) {
  return (
    <div className={s.root}>
      <AdminBfcacheGuard />
      <header className={s.header}>
        <p className={s.brand}>AYUTA 관리자</p>
        <span className={s.spacer} />
        <span className={s.who}>
          {ROLE_LABEL[user.role]} · {user.email}
        </span>
        <AdminLogoutButton />
      </header>
      <div className={s.body}>
        <AdminNav isSuper={user.role === 'super'} />
        <main className={s.main}>{children}</main>
      </div>
    </div>
  )
}
