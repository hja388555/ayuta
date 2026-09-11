'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useState } from 'react'
import { LoginRequiredModal } from './LoginRequiredModal'

type Labels = { home: string; inquiry: string; login: string; signup: string; mypage: string; logout: string; admin: string; chatLoginBody1: string; chatLoginBody2: string }

/**
 * 사이트 헤더(큐 Q32, Figma [v2] 205:3 PC / 207:3 Mobile).
 * PC: 로고 · 홈/1:1 문의/마이페이지 · 대표번호 · 로그인/회원가입 · 한국어/日本語.
 * Mobile: 로고 · 로그인/회원가입 · 언어 — 메뉴와 전화는 하단 탭바(MobileTabBar)가 맡는다.
 * 비회원이 마이페이지를 누르면 이동하지 않고 로그인 유도 팝업(227:153)을 띄운다.
 * [1:1 문의]는 기타 광고 문의 폼이 아니라 1:1 채팅을 연다(Q40) — 비회원은 탭바와 같은 채팅 로그인 팝업.
 * [관리자] 버튼 숨김은 보안이 아니다 — /manage 는 서버가 매 요청 판정한다(1-16 규칙 3).
 */
export function SiteHeader({
  locale,
  loggedIn,
  isAdmin,
  phone,
  labels,
}: {
  locale: string
  loggedIn: boolean
  isAdmin: boolean
  phone: string
  labels: Labels
}) {
  const pathname = usePathname() ?? `/${locale}`
  const router = useRouter()
  const [askLogin, setAskLogin] = useState<'mypage' | 'chat' | null>(null)
  const pathFor = (target: string) => pathname.replace(/^\/(ko|ja)(?=\/|$)/, `/${target}`)
  const home = `/${locale}`
  const current = (href: string) => (pathname === href || pathname.startsWith(`${href}/`) ? 'page' : undefined)

  async function logout() {
    await fetch('/api/users/logout', { method: 'POST' }).catch(() => {})
    router.push(home)
    router.refresh()
  }

  return (
    <header className="site-header">
      <Link href={home} className="site-logo" aria-label="AYUTA">
        <img src="/ui/logo.png" alt="" width={84} height={56} />
      </Link>
      <nav className="site-nav">
        <Link href={home} aria-current={pathname === home ? 'page' : undefined}>
          {labels.home}
        </Link>
        <Link
          href={`${home}/chat`}
          aria-current={current(`${home}/chat`)}
          onClick={(e) => {
            if (loggedIn) return
            e.preventDefault()
            setAskLogin('chat')
          }}
        >
          {labels.inquiry}
        </Link>
        <Link
          href={`${home}/mypage`}
          aria-current={current(`${home}/mypage`)}
          onClick={(e) => {
            if (loggedIn) return
            e.preventDefault()
            setAskLogin('mypage')
          }}
        >
          {labels.mypage}
        </Link>
      </nav>
      <LoginRequiredModal
        locale={locale}
        open={askLogin !== null}
        onClose={() => setAskLogin(null)}
        next={askLogin === 'chat' ? `${home}/chat` : undefined}
        body={askLogin === 'chat' ? [labels.chatLoginBody1, labels.chatLoginBody2] : undefined}
      />
      <div className="site-header-right">
        <a className="site-phone" href={`tel:${phone.replace(/[^\d+]/g, '')}`}>
          <img src="/ui/phone.svg" alt="" width={18} height={18} />
          {phone}
        </a>
        <div className="site-auth">
          {loggedIn ? (
            <>
              {isAdmin ? (
                <Link href="/manage" className="btn btn-primary">
                  {`[${labels.admin}]`}
                </Link>
              ) : null}
              <button type="button" onClick={logout} className="btn btn-secondary">
                {labels.logout}
              </button>
            </>
          ) : (
            <>
              <Link href={`${home}/login`} className="btn btn-secondary">
                {labels.login}
              </Link>
              <Link href={`${home}/signup`} className="btn btn-primary">
                {labels.signup}
              </Link>
            </>
          )}
        </div>
        <nav className="seg" aria-label="Language">
          <Link href={pathFor('ko')} hrefLang="ko" aria-current={locale === 'ko' ? 'true' : undefined}>
            한국어
          </Link>
          <Link href={pathFor('ja')} hrefLang="ja" aria-current={locale === 'ja' ? 'true' : undefined}>
            日本語
          </Link>
        </nav>
      </div>
    </header>
  )
}
