import type { MetadataRoute } from 'next'
import { routing } from '@/i18n/routing'
import { CATEGORIES } from '@/lib/categories'
import { loadServices } from '@/lib/services/load'
import { siteUrl } from '@/lib/seo'

/**
 * /sitemap.xml (큐 Q27). 검색에 나와야 하는 공개 페이지만 — 표지와 공개된 광고 서비스의 견적·문의 폼.
 * 로그인·마이페이지·결제·견적 링크·관리자는 넣지 않는다(robots.ts 에서도 막는다).
 * 항목마다 다른 언어 주소를 alternates 로 달아 ko/ja 가 서로를 가리키게 한다.
 *
 * 서비스 목록은 DB 에서 읽는다 — 관리자가 6번 이후를 추가하면 검색에도 그대로 나와야 하고,
 * 비공개로 내린 서비스는 빠져야 한다. DB 가 비거나 읽지 못하면 기존 상수로 돌아간다.
 */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = siteUrl()
  const services = await loadServices().catch(() => [])
  const slugs = services.length > 0 ? services.map((s) => s.slug) : CATEGORIES.map((c) => c.slug)

  // 약관 세 문서(큐 Q25 2차, 환불 정책 v2 13-C)도 공개 페이지다 — 우선순위만 낮게
  const paths = ['', ...slugs.map((slug) => `/order/${slug}`), '/terms', '/privacy', '/refund']
  const abs = (p: string) => new URL(p, base).toString()

  // 구글은 changefreq·priority 를 읽지 않고 lastModified 만 본다. 배포 시각을 쓴다 —
  // 페이지 단위 수정 시각이 없어서(문구는 messages, 단가는 DB) 배포가 가장 가까운 근사다
  const lastModified = deployedAt()

  return paths.flatMap((path) => {
    const languages = Object.fromEntries(routing.locales.map((l) => [l, abs(`/${l}${path}`)]))
    // 언어를 정하지 못한 검색 엔진에게 보여줄 기본 — 페이지 <head> 의 x-default 와 같은 곳을 가리킨다
    languages['x-default'] = abs(`/${routing.defaultLocale}${path}`)
    return routing.locales.map((locale) => ({
      url: abs(`/${locale}${path}`),
      lastModified,
      alternates: { languages },
    }))
  })
}

/** 배포 시각. Vercel 이 넣어 주는 커밋 시각을 쓰고, 없으면 지금 */
function deployedAt(): Date {
  const raw = process.env.VERCEL_GIT_COMMIT_SHA ? process.env.VERCEL_DEPLOYMENT_CREATED_AT : undefined
  const at = raw ? new Date(Number(raw)) : new Date()
  return Number.isNaN(at.getTime()) ? new Date() : at
}
