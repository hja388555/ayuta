import React from 'react'
import type { Metadata } from 'next'
import { siteUrl } from '@/lib/seo'
import { getLocale } from 'next-intl/server'
import './globals.css'

// canonical·hreflang 을 상대 경로로 적어도 절대 주소로 나가게 하는 기준(큐 Q27). 도메인을 받으면
// NEXT_PUBLIC_SITE_URL 만 바꾼다. 네이버 소유확인 토큰도 도메인 연결 후 환경변수로 넣는다
export const metadata: Metadata = {
  metadataBase: siteUrl(),
  title: 'AYUTA',
  ...(process.env.NAVER_SITE_VERIFICATION
    ? { verification: { other: { 'naver-site-verification': process.env.NAVER_SITE_VERIFICATION } } }
    : {}),
}

// /manage 는 이 트리 아래이지만 [locale] 세그먼트 밖이다 — proxy 의 matcher 가
// /manage 를 로케일 협상에서 제외하므로 그 경로는 getLocale() 이 기본 로케일을 돌려준다.
export default async function FrontendLayout({ children }: { children: React.ReactNode }) {
  const locale = await getLocale()
  return (
    <html lang={locale}>
      <body>{children}</body>
    </html>
  )
}
