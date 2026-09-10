import type { MetadataRoute } from 'next'
import { siteUrl } from '@/lib/seo'

/**
 * /robots.txt (큐 Q27). 공개 페이지(표지·견적 폼)만 열고, 개인 화면·결제·관리자는 막는다.
 * robots 는 "검색에 올리지 말라"는 요청일 뿐 접근 제어가 아니다 — 이 경로들은 서버가 따로
 * 로그인·소유권을 확인한다. 페이지마다 noindex 메타도 함께 둔다(두 겹).
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: '*',
      allow: '/',
      disallow: [
        '/manage',
        '/api/',
        '/*/login',
        '/*/signup',
        '/*/mypage',
        '/*/quote/',
        '/*/order/complete',
        '/*/order/*/checkout',
      ],
    },
    sitemap: new URL('/sitemap.xml', siteUrl()).toString(),
  }
}
