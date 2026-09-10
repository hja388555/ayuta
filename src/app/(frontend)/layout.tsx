import React from 'react'
import { getLocale } from 'next-intl/server'
import './globals.css'

export const metadata = { title: 'AYUTA' }

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
