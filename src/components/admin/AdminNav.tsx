'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useState } from 'react'
import s from './AdminShell.module.css'

type NavItem = {
  label: string
  icon: string
  href?: string
  /** 링크 없이 비활성으로 보여 줄 때의 사유 */
  hint?: string
  superOnly?: boolean
  sub?: boolean
}

// 순서·문구는 Figma A2 사이드바를 따른다. 계약서·약관과 관리자 계정은 설정 아래 하위 항목으로 둔다
const ITEMS: NavItem[] = [
  { label: '대시보드', icon: 'home', href: '/manage' },
  { label: '주문 · 접수 관리', icon: 'doc', href: '/manage/orders' },
  { label: '환불 관리', icon: 'refund', hint: '결제 연동 후' },
  { label: '이미지 관리', icon: 'image', href: '/manage/images' },
  { label: '단가 관리', icon: 'card', href: '/manage/prices' },
  { label: '문의 · 채팅', icon: 'chat', href: '/manage/inquiries' },
  { label: '설정', icon: 'user', href: '/manage/settings' },
  { label: '계약서 · 약관', icon: 'doc', href: '/manage/legal', sub: true },
  { label: '관리자 계정', icon: 'user', href: '/manage/accounts', sub: true, superOnly: true },
]

const isActive = (pathname: string, href: string) =>
  href === '/manage' ? pathname === href : pathname === href || pathname.startsWith(`${href}/`)

export function AdminNav({ isSuper }: { isSuper: boolean }) {
  const pathname = usePathname() ?? ''
  return (
    <nav className={s.nav} aria-label="관리자 메뉴">
      {ITEMS.filter((i) => isSuper || !i.superOnly).map((item) => {
        const icon = <img className={s.icon} src={`/ui/admin-${item.icon}.svg`} alt="" width={20} height={20} />
        const cls = [s.item, item.sub ? s.sub : ''].join(' ')
        if (!item.href) {
          return (
            <span key={item.label} className={`${cls} ${s.disabled}`} aria-disabled="true">
              {icon}
              <span className={s.label}>{item.label}</span>
              <span className={s.hint}>{item.hint}</span>
            </span>
          )
        }
        const active = isActive(pathname, item.href)
        return (
          <Link key={item.label} href={item.href} className={`${cls} ${active ? s.active : ''}`} aria-current={active ? 'page' : undefined}>
            {item.sub ? null : icon}
            <span className={s.label}>{item.label}</span>
          </Link>
        )
      })}
      {isSuper ? null : <p className={s.note}>중간관리자는 단가 · 설정 · 약관을 조회만 할 수 있고, 환불 승인 · 관리자 계정 관리에는 접근할 수 없습니다.</p>}
    </nav>
  )
}

export function AdminLogoutButton() {
  const [busy, setBusy] = useState(false)
  const logout = async () => {
    setBusy(true)
    try {
      await fetch('/api/users/logout', { method: 'POST', credentials: 'include' })
    } finally {
      window.location.href = '/ko/login'
    }
  }
  return (
    <button type="button" className={s.logout} onClick={logout} disabled={busy}>
      로그아웃
    </button>
  )
}
