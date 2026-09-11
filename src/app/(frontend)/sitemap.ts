import type { MetadataRoute } from 'next'
import { routing } from '@/i18n/routing'
import { CATEGORIES } from '@/lib/categories'
import { siteUrl } from '@/lib/seo'

/**
 * /sitemap.xml (큐 Q27). 검색에 나와야 하는 공개 페이지만 — 표지와 1~5번 견적·문의 폼.
 * 로그인·마이페이지·결제·견적 링크·관리자는 넣지 않는다(robots.ts 에서도 막는다).
 * 항목마다 다른 언어 주소를 alternates 로 달아 ko/ja 가 서로를 가리키게 한다.
 */
export default function sitemap(): MetadataRoute.Sitemap {
  const base = siteUrl()
  // 약관 두 문서(큐 Q25 2차)도 공개 페이지다 — 우선순위만 낮게
  const paths = ['', ...CATEGORIES.map((c) => `/order/${c.slug}`), '/terms', '/privacy']
  const abs = (p: string) => new URL(p, base).toString()

  return paths.flatMap((path) => {
    const languages = Object.fromEntries(routing.locales.map((l) => [l, abs(`/${l}${path}`)]))
    return routing.locales.map((locale) => ({
      url: abs(`/${locale}${path}`),
      changeFrequency: 'weekly' as const,
      priority: path === '' ? 1 : path.startsWith('/order/') ? 0.8 : 0.3,
      alternates: { languages },
    }))
  })
}
