import Link from 'next/link'
import { getTranslations, setRequestLocale } from 'next-intl/server'
import { Shell } from '@/components/Shell'
import { CATEGORIES } from '@/lib/categories'

type Props = { params: Promise<{ locale: string }> }

// 표지는 상태가 없는 서버 컴포넌트다.
export default async function CoverPage({ params }: Props) {
  const { locale } = await params
  setRequestLocale(locale)
  const t = await getTranslations('cover')
  const tCat = await getTranslations('categories')
  const tInquiry = await getTranslations('inquiry')

  return (
    <main>
      {/* 히어로 — 배경색과 글자만. 이미지는 넣지 않는다 (대표님 확정) */}
      <Shell as="section" bleed background="var(--surface-brand)">
        <div style={{ padding: '64px 0' }}>
          <h1 style={{ fontSize: 'var(--fs-hero)', margin: 0, color: 'var(--brand-900)' }}>{t('title')}</h1>
          <p style={{ fontSize: 'var(--fs-body)', color: 'var(--ink-700)' }}>{t('subtitle')}</p>
        </div>
      </Shell>

      <Shell as="section">
        <div style={{ padding: '48px 0' }}>
          <h2 style={{ fontSize: 'var(--fs-h2)' }}>{t('stepService')}</h2>

          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))',
              gap: 16,
            }}
          >
            {CATEGORIES.map((c) => (
              // 클릭이 곧 이동이다. 확인 단계·[다음] 버튼을 만들지 않는다 (G1, G2-7)
              <Link
                key={c.slug}
                href={`/${locale}/order/${c.slug}`}
                style={{
                  display: 'block',
                  padding: '24px 20px',
                  border: '1px solid var(--line-strong)',
                  borderRadius: 8,
                  textDecoration: 'none',
                  color: 'var(--ink-900)',
                }}
              >
                {tCat(c.slug)}
              </Link>
            ))}
          </div>
        </div>
      </Shell>

      {/* 문의 안내는 본문 하단에 둔다 (플로팅 아님) */}
      <Shell as="footer" bleed background="var(--surface)">
        <div style={{ padding: '32px 0', color: 'var(--ink-500)', fontSize: 'var(--fs-sm)' }}>
          {tInquiry('notice')}
        </div>
      </Shell>
    </main>
  )
}
