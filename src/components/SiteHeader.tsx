'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'

type Labels = { home: string; inquiry: string; login: string; signup: string; mypage: string; logout: string; admin: string }

/**
 * 최소 헤더 — 로그인·마이페이지 진입과 [관리자] 버튼(요구사항 1-16), 언어 전환.
 * 대표번호 크게 표기·모바일 하단 탭바 등 전체 헤더 디자인은 별도 작업이다.
 * [관리자] 버튼 숨김은 보안이 아니다 — /manage 는 서버가 매 요청 판정한다(1-16 규칙 3).
 */
export function SiteHeader({ locale, loggedIn, isAdmin, labels }: { locale: string; loggedIn: boolean; isAdmin: boolean; labels: Labels }) {
  const pathname = usePathname() ?? `/${locale}`
  const router = useRouter()
  const other = locale === 'ja' ? 'ko' : 'ja'
  const switchPath = pathname.replace(/^\/(ko|ja)(?=\/|$)/, `/${other}`)

  async function logout() {
    await fetch('/api/users/logout', { method: 'POST' }).catch(() => {})
    router.push(`/${locale}`)
    router.refresh()
  }

  const link = { textDecoration: 'none', color: 'inherit' } as const
  return (
    <header style={{ borderBottom: '1px solid var(--ink-100, #ECEEF1)' }}>
      <nav style={{ display: 'flex', alignItems: 'center', gap: 16, padding: '12px var(--side)', flexWrap: 'wrap', fontSize: 'var(--fs-sm, 14px)' }}>
        <Link href={`/${locale}`} style={{ ...link, fontWeight: 700, fontSize: 18 }}>
          AYUTA
        </Link>
        <Link href={`/${locale}`} style={link}>
          {labels.home}
        </Link>
        <Link href={`/${locale}/order/other`} style={link}>
          {labels.inquiry}
        </Link>
        <span style={{ flex: 1 }} />
        {isAdmin ? (
          <Link href="/manage" style={{ ...link, fontWeight: 700 }}>
            {`[${labels.admin}]`}
          </Link>
        ) : null}
        {loggedIn ? (
          <>
            <Link href={`/${locale}/mypage`} style={link}>
              {labels.mypage}
            </Link>
            <button type="button" onClick={logout} style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', font: 'inherit' }}>
              {labels.logout}
            </button>
          </>
        ) : (
          <>
            <Link href={`/${locale}/login`} style={link}>
              {labels.login}
            </Link>
            <Link href={`/${locale}/signup`} style={link}>
              {labels.signup}
            </Link>
          </>
        )}
        <Link href={switchPath} style={link} hrefLang={other}>
          {other === 'ja' ? '日本語' : '한국어'}
        </Link>
      </nav>
    </header>
  )
}
