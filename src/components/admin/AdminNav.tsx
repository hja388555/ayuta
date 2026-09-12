'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useEffect, useState } from 'react'
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

/**
 * 뒤로가기 캐시(bfcache)에서 되살아난 관리자 화면은 서버를 거치지 않아 로그아웃 뒤에도 고객 정보가 보인다.
 * 복원(persisted)되면 새로고침해 게이트(requireAdmin)를 다시 태운다 — 세션이 없으면 404 가 된다.
 */
export function AdminBfcacheGuard() {
  useEffect(() => {
    const onShow = (e: PageTransitionEvent) => {
      if (e.persisted) window.location.reload()
    }
    window.addEventListener('pageshow', onShow)
    // HTTP 캐시에서 되살린 뒤로/앞으로 이동도 서버를 안 거친다(dev 는 Next 가 no-cache 로 덮어써 특히 그렇다).
    // 그때는 화면을 가린 채 세션을 다시 묻고, 관리자 세션이 없으면 로그인 화면으로 바꾼다
    const nav = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming | undefined
    if (nav?.type === 'back_forward') {
      const root = document.documentElement
      root.style.visibility = 'hidden'
      fetch('/api/users/me', { cache: 'no-store', credentials: 'include' })
        .then((res) => (res.ok ? res.json() : null))
        .then((json: { user?: { role?: string } | null } | null) => {
          const role = json?.user?.role
          if (role === 'super' || role === 'manager') root.style.visibility = ''
          else window.location.replace('/ko/login?next=%2Fmanage')
        })
        .catch(() => window.location.reload())
    }
    return () => window.removeEventListener('pageshow', onShow)
  }, [])
  return null
}

export function AdminLogoutButton() {
  const [busy, setBusy] = useState(false)
  const logout = async () => {
    setBusy(true)
    try {
      await fetch('/api/users/logout', { method: 'POST', credentials: 'include' })
      // 공용 PC: 같은 브라우저에 남은 비회원 채팅 쿠키도 함께 지운다
      await fetch('/api/chat/guest', { method: 'DELETE', credentials: 'include' }).catch(() => {})
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
