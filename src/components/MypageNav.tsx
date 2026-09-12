'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import s from './Mypage.module.css'

type Labels = { label: string; orders: string; contracts: string; profile: string; password: string; withdraw: string; logout: string }

/**
 * 마이페이지 메뉴(Figma [v2] 09 사이드바). PC 는 세로 목록, 모바일은 가로 칩(CSS 가 바꾼다).
 * 주문 상세(/mypage/orders/…)는 "주문 내역" 아래에 있으므로 그 항목을 켠다.
 */
export function MypageNav({ locale, labels }: { locale: string; labels: Labels }) {
  const pathname = usePathname()
  const router = useRouter()
  const base = `/${locale}/mypage`
  const items = [
    { href: base, label: labels.orders, match: (p: string) => p === base || p.startsWith(`${base}/orders`) },
    { href: `${base}/contracts`, label: labels.contracts },
    { href: `${base}/profile`, label: labels.profile },
    { href: `${base}/password`, label: labels.password },
    { href: `${base}/withdraw`, label: labels.withdraw },
  ]

  async function logout() {
    await fetch('/api/users/logout', { method: 'POST' }).catch(() => {})
    // 공용 PC: 로그인 전에 쓰던 비회원 채팅 쿠키도 함께 지운다
    await fetch('/api/chat/guest', { method: 'DELETE' }).catch(() => {})
    router.push(`/${locale}`)
    router.refresh()
  }

  return (
    <nav className={s.nav} aria-label={labels.label}>
      {items.map((it) => {
        const on = it.match ? it.match(pathname) : pathname === it.href || pathname.startsWith(`${it.href}/`)
        return (
          <Link key={it.href} href={it.href} className={s.navItem} aria-current={on ? 'page' : undefined}>
            {it.label}
          </Link>
        )
      })}
      <button type="button" className={`${s.navItem} ${s.navLogout}`} onClick={logout}>
        {labels.logout}
      </button>
    </nav>
  )
}
