'use client'

import Link from 'next/link'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { Suspense, useState } from 'react'
import { LoginRequiredModal } from './LoginRequiredModal'

type Labels = { home: string; inquiry: string; login: string; signup: string; mypage: string; logout: string; admin: string }

/** 언어만 바꾼 주소. 쿼리(주문 선택·나라·목적)는 그대로 둔다 — 떼면 결제 화면이 404 가 되고 폼 선택이 사라진다 */
export function localeSwitchHref(pathname: string, search: string, target: string): string {
  const path = pathname.replace(/^\/(ko|ja)(?=\/|$)/, `/${target}`)
  const qs = search.replace(/^\?/, '')
  return qs ? `${path}?${qs}` : path
}

/**
 * 한국어/日本語 링크. useSearchParams 는 Suspense 경계 안에서만 쓸 수 있어(Next 16) 따로 뗐다.
 * 폼이 선택을 history.replaceState 로 주소에 옮겨 적으면 Next 라우터가 useSearchParams 에 반영한다.
 */
function LanguageLinks({ locale, pathname, search }: { locale: string; pathname: string; search: string }) {
  const hrefFor = (target: string) => localeSwitchHref(pathname, search, target)
  return (
    <nav className="seg" aria-label="Language">
      <Link href={hrefFor('ko')} hrefLang="ko" aria-current={locale === 'ko' ? 'true' : undefined}>
        한국어
      </Link>
      <Link href={hrefFor('ja')} hrefLang="ja" aria-current={locale === 'ja' ? 'true' : undefined}>
        日本語
      </Link>
    </nav>
  )
}

function LanguageLinksWithQuery(props: { locale: string; pathname: string }) {
  const sp = useSearchParams()
  return <LanguageLinks {...props} search={sp?.toString() ?? ''} />
}

/**
 * 사이트 헤더(큐 Q32, Figma [v2] 205:3 PC / 207:3 Mobile).
 * PC: 로고 · 홈/1:1 문의/마이페이지 · 대표번호 · 로그인/회원가입 · 한국어/日本語.
 * Mobile: 로고 · 로그인/회원가입 · 언어 — 메뉴와 전화는 하단 탭바(MobileTabBar)가 맡는다.
 * 비회원이 마이페이지를 누르면 이동하지 않고 로그인 유도 팝업(227:153)을 띄운다.
 * [1:1 문의]는 1:1 채팅을 연다(Q40). 비회원도 채팅할 수 있어(2026-09-12) 로그인 팝업 없이 바로 이동한다.
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
  const [askLogin, setAskLogin] = useState(false)
  const home = `/${locale}`
  const current = (href: string) => (pathname === href || pathname.startsWith(`${href}/`) ? 'page' : undefined)

  async function logout() {
    await fetch('/api/users/logout', { method: 'POST' }).catch(() => {})
    // 공용 PC: 로그인 전에 쓰던 비회원 채팅 쿠키도 함께 지운다
    await fetch('/api/chat/guest', { method: 'DELETE' }).catch(() => {})
    router.push(home)
    router.refresh()
  }

  return (
    <header className="site-header">
      <Link href={home} className="site-logo" aria-label="AYUTA">
        <img src={locale === 'ja' ? '/ui/logo-ja.png' : '/ui/logo.png'} alt="" width={84} height={56} />
      </Link>
      <nav className="site-nav">
        <Link href={home} aria-current={pathname === home ? 'page' : undefined}>
          {labels.home}
        </Link>
        <Link href={`${home}/chat`} aria-current={current(`${home}/chat`)}>
          {labels.inquiry}
        </Link>
        <Link
          href={`${home}/mypage`}
          aria-current={current(`${home}/mypage`)}
          onClick={(e) => {
            if (loggedIn) return
            e.preventDefault()
            setAskLogin(true)
          }}
        >
          {labels.mypage}
        </Link>
      </nav>
      <LoginRequiredModal locale={locale} open={askLogin} onClose={() => setAskLogin(false)} />
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
        {/* 쿼리를 읽기 전(정적 렌더)에는 경로만 바꾼 링크를 보여 주고, 읽은 뒤 쿼리를 붙인다 */}
        <Suspense fallback={<LanguageLinks locale={locale} pathname={pathname} search="" />}>
          <LanguageLinksWithQuery locale={locale} pathname={pathname} />
        </Suspense>
      </div>
    </header>
  )
}
