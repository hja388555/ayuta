import type { CompanyInfo } from '@/lib/company'
import { siteUrl } from '@/lib/seo'

/**
 * 검색 엔진이 읽는 구조화 데이터(schema.org). 화면에는 아무것도 그리지 않는다.
 * 일본은 검색이 사실상 구글 하나라(야후! 재팬도 구글 엔진) 구글이 읽는 JSON-LD 만 둔다.
 */
export function JsonLd({ data }: { data: object }) {
  return <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(data) }} />
}

/** 표지에 붙는 회사·사이트 정보. 브랜드명으로 검색했을 때 회사 정보를 묶어서 인식시킨다 */
export function organizationJsonLd(locale: string, company: CompanyInfo) {
  const base = siteUrl().toString().replace(/\/$/, '')
  return {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    name: company.name,
    url: `${base}/${locale}`,
    logo: `${base}/og.png`,
    email: company.email,
    telephone: company.phone,
    address: { '@type': 'PostalAddress', streetAddress: company.address, addressCountry: 'KR' },
    areaServed: ['KR', 'JP'],
  }
}

/** 주문 화면 하나. 어떤 광고 상품인지와, 표지 → 이 화면의 위치를 알린다 */
export function serviceJsonLd(locale: string, slug: string, name: string, description: string, homeLabel: string) {
  const base = siteUrl().toString().replace(/\/$/, '')
  const url = `${base}/${locale}/order/${slug}`
  return [
    {
      '@context': 'https://schema.org',
      '@type': 'Service',
      name,
      description,
      url,
      serviceType: name,
      areaServed: ['KR', 'JP'],
      provider: { '@type': 'Organization', name: 'AYUTA', url: `${base}/${locale}` },
    },
    {
      '@context': 'https://schema.org',
      '@type': 'BreadcrumbList',
      itemListElement: [
        { '@type': 'ListItem', position: 1, name: homeLabel, item: `${base}/${locale}` },
        { '@type': 'ListItem', position: 2, name, item: url },
      ],
    },
  ]
}
