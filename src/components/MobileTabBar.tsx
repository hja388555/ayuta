'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useState } from 'react'
import { LoginRequiredModal } from './LoginRequiredModal'

type Labels = { home: string; call: string; chat: string; mypage: string; back: string; next: string }

/**
 * 모바일 하단 고정 탭바(큐 Q32, Figma [v2] 207:112). 768px 미만에서만 보인다(globals.css .tabbar).
 * 아이콘은 시안에서 받은 SVG 다(public/ui/tab-*.svg). 시안은 홈이 선택된 상태만 그려져 있어,
 * 다른 탭의 선택 아이콘은 같은 SVG 의 선 색만 파랑으로 바꾼 사본(-active)을 쓴다.
 * 채팅 탭은 1:1 채팅(큐 Q37, /chat)을 연다. 비회원도 채팅할 수 있어(2026-09-12) 바로 이동한다.
 * 비회원이 마이페이지 탭을 누르면 이동하지 않고 로그인 유도 팝업(227:153)을 띄운다.
 * 메인이 아닌 화면은 탭바 대신 이전/다음 화살표 바를 보여준다(2026-09-14 클라이언트 요청 3라운드).
 */
export function MobileTabBar({ locale, phone, loggedIn, labels }: { locale: string; phone: string; loggedIn: boolean; labels: Labels }) {
  const [askLogin, setAskLogin] = useState(false)
  const pathname = usePathname() ?? `/${locale}`
  const home = `/${locale}`
  const chat = `${home}/chat`
  const mypage = `${home}/mypage`
  const isAt = (href: string, exact = false) => (exact ? pathname === href : pathname === href || pathname.startsWith(`${href}/`))
  // 아이콘 색은 currentColor 마스크로 그려 탭 색(비선택/선택)을 그대로 따라간다
  const tabIcon = (name: string) => (
    <span
      className="icon-mask"
      style={{ width: 24, height: 24, ['--icon-url' as string]: `url(/ui/tab-${name}.svg)` }}
      aria-hidden
    />
  )

  if (pathname !== home) {
    return (
      <nav className="arrowbar" aria-label="Navigation">
        <button type="button" onClick={() => window.history.back()}>
          {labels.back}
        </button>
        <button type="button" onClick={() => window.history.forward()}>
          {labels.next}
        </button>
      </nav>
    )
  }

  const onHome = isAt(home, true)
  const onChat = isAt(chat)
  const onMypage = isAt(mypage)
  return (
    <nav className="tabbar" aria-label="Menu">
      <Link href={home} aria-current={onHome ? 'page' : undefined}>
        {tabIcon('home')}
        {labels.home}
      </Link>
      <a href={`tel:${phone.replace(/[^\d+]/g, '')}`}>
        {tabIcon('phone')}
        {labels.call}
      </a>
      <Link href={chat} aria-current={onChat ? 'page' : undefined}>
        {tabIcon('chat')}
        {labels.chat}
      </Link>
      <Link
        href={mypage}
        aria-current={onMypage ? 'page' : undefined}
        onClick={(e) => {
          if (loggedIn) return
          e.preventDefault()
          setAskLogin(true)
        }}
      >
        {tabIcon('user')}
        {labels.mypage}
      </Link>
      <LoginRequiredModal locale={locale} open={askLogin} onClose={() => setAskLogin(false)} />
    </nav>
  )
}
