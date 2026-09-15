'use client'

import Link from 'next/link'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { Suspense, useState } from 'react'
import { LoginRequiredModal } from './LoginRequiredModal'
import { isHeaderHidden, isPcHeaderHidden } from '../lib/header-visibility'

type Labels = {
  logo: string
  login: string
  signup: string
  mypage: string
  logout: string
  admin: string
  chat: string
  call: string
}

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
  labels,
  phone,
}: {
  locale: string
  loggedIn: boolean
  isAdmin: boolean
  labels: Labels
  phone: string
}) {
  const pathname = usePathname() ?? `/${locale}`
  const router = useRouter()
  const [askLogin, setAskLogin] = useState(false)
  const home = `/${locale}`

  // 1~4번 주문 화면은 헤더 자체를 없앤다(6라운드) — 판정은 header-visibility.ts(단위 테스트 대상)
  if (isHeaderHidden(pathname)) return null

  async function logout() {
    await fetch('/api/users/logout', { method: 'POST' }).catch(() => {})
    // 공용 PC: 로그인 전에 쓰던 비회원 채팅 쿠키도 함께 지운다
    await fetch('/api/chat/guest', { method: 'DELETE' }).catch(() => {})
    router.push(home)
    router.refresh()
  }

  return (
    <header className={isPcHeaderHidden(pathname) ? 'site-header site-header-pc-hidden' : 'site-header'}>
      {/* 로고·메뉴·전화를 지운 헤더에도 홈으로 가는 링크는 남겨 둔다(스크린리더 전용) */}
      <Link href={home} className="sr-only">
        {labels.logo}
      </Link>
      <LoginRequiredModal locale={locale} open={askLogin} onClose={() => setAskLogin(false)} />
      {/* 쿼리를 읽기 전(정적 렌더)에는 경로만 바꾼 링크를 보여 주고, 읽은 뒤 쿼리를 붙인다 */}
      <Suspense fallback={<LanguageLinks locale={locale} pathname={pathname} search="" />}>
        <LanguageLinksWithQuery locale={locale} pathname={pathname} />
      </Suspense>
      <div className="site-header-right">
        <div className="site-auth">
          {loggedIn ? (
            <>
              <Link href={`${home}/mypage`} className="btn btn-secondary site-auth-mypage">
                {labels.mypage}
              </Link>
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
      </div>
    </header>
  )
}
