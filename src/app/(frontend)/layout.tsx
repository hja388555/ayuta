import React from 'react'
import type { Metadata, Viewport } from 'next'
import { BRAND_BLUE } from '../manifest'
import { siteUrl } from '@/lib/seo'
import { getLocale } from 'next-intl/server'
import 'pretendard/dist/web/variable/pretendardvariable-dynamic-subset.css'
import './globals.css'

// 모바일 주소창·설치 앱 상단 색(큐 Q29). manifest 의 theme_color 와 같은 값
export const viewport: Viewport = { themeColor: BRAND_BLUE }

// canonical·hreflang 을 상대 경로로 적어도 절대 주소로 나가게 하는 기준(큐 Q27). 도메인을 받으면
// NEXT_PUBLIC_SITE_URL 만 바꾼다.
// 네이버 서치어드바이저 소유확인 토큰. 공개 메타태그라 비밀값이 아니다 — 환경변수로도 덮어쓸 수 있게 둔다
const NAVER_VERIFICATION = process.env.NAVER_SITE_VERIFICATION ?? 'b94f156ae0334a4d20086a54cce4cd6fac0e9b7d'
// 구글 서치콘솔 소유확인 토큰. 네이버와 같은 성격이라 나란히 둔다
const GOOGLE_VERIFICATION =
  process.env.GOOGLE_SITE_VERIFICATION ?? 'ndT79sfVm0RHoT1sIHQysKOjAlyJ1hARDIijUC_Vc40'

export const metadata: Metadata = {
  metadataBase: siteUrl(),
  title: 'AYUTA',
  verification: {
    google: GOOGLE_VERIFICATION,
    other: { 'naver-site-verification': NAVER_VERIFICATION },
  },
}

// /manage 는 이 트리 아래이지만 [locale] 세그먼트 밖이다 — proxy 의 matcher 가
// /manage 를 로케일 협상에서 제외하므로 그 경로는 getLocale() 이 기본 로케일을 돌려준다.
export default async function FrontendLayout({ children }: { children: React.ReactNode }) {
  const locale = await getLocale()
  return (
    <html lang={locale} suppressHydrationWarning>
      <body>{children}</body>
    </html>
  )
}
