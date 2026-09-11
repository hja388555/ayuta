'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

type Labels = { home: string; call: string; chat: string; mypage: string }

/**
 * 모바일 하단 고정 탭바(큐 Q32, Figma [v2] 207:112). 768px 미만에서만 보인다(globals.css .tabbar).
 * 아이콘은 시안에서 받은 SVG 다(public/ui/tab-*.svg). 시안은 홈이 선택된 상태만 그려져 있어,
 * 다른 탭의 선택 아이콘은 같은 SVG 의 선 색만 파랑으로 바꾼 사본(-active)을 쓴다.
 * 1:1 채팅(Q37)이 생기기 전까지 채팅 탭은 1:1 문의 폼으로 보낸다.
 */
export function MobileTabBar({ locale, phone, labels }: { locale: string; phone: string; labels: Labels }) {
  const pathname = usePathname() ?? `/${locale}`
  const home = `/${locale}`
  const chat = `${home}/order/other`
  const mypage = `${home}/mypage`
  const isAt = (href: string, exact = false) => (exact ? pathname === href : pathname === href || pathname.startsWith(`${href}/`))
  const icon = (name: string, active: boolean) => `/ui/tab-${name}${active ? '-active' : ''}.svg`

  const onHome = isAt(home, true)
  const onChat = isAt(chat)
  const onMypage = isAt(mypage)
  return (
    <nav className="tabbar" aria-label="Menu">
      <Link href={home} aria-current={onHome ? 'page' : undefined}>
        <img src={icon('home', onHome)} alt="" width={22} height={22} />
        {labels.home}
      </Link>
      <a href={`tel:${phone.replace(/[^\d+]/g, '')}`}>
        <img src={icon('phone', false)} alt="" width={22} height={22} />
        {labels.call}
      </a>
      <Link href={chat} aria-current={onChat ? 'page' : undefined}>
        <img src={icon('chat', onChat)} alt="" width={22} height={22} />
        {labels.chat}
      </Link>
      <Link href={mypage} aria-current={onMypage ? 'page' : undefined}>
        <img src={icon('user', onMypage)} alt="" width={22} height={22} />
        {labels.mypage}
      </Link>
    </nav>
  )
}
