import { notFound } from 'next/navigation'
import { getTranslations, setRequestLocale } from 'next-intl/server'
import { Shell } from '@/components/Shell'
import { ImageBand } from '@/components/ImageBand'
import { TierForm } from '@/components/TierForm'
import { GroupForm } from '@/components/GroupForm'
import { categoryBySlug } from '@/lib/categories'
import { formFor } from '@/lib/category-groups'
import { loadPriceBook } from '@/lib/price-book'
import { loadCategoryModel } from '@/lib/pricing-model'
import { currencyForLocale } from '@/lib/payments/channel'

export const dynamic = 'force-dynamic'

type Props = {
  params: Promise<{ locale: string; category: string }>
  searchParams: Promise<Record<string, string | string[] | undefined>>
}

export default async function OrderPage({ params, searchParams }: Props) {
  const { locale, category } = await params
  const sp = await searchParams
  setRequestLocale(locale)

  // 표지에서 넘어온 나라·목적. 여기서는 다시 고르게 하지 않고 결제 화면까지 그대로 들고 간다
  const country = Array.isArray(sp.country) ? sp.country : sp.country ? [sp.country] : []
  const purpose = typeof sp.purpose === 'string' ? sp.purpose : undefined

  const def = categoryBySlug(category)
  // 없는 슬러그는 404. 500 이 나면 어떤 슬러그가 존재하는지 알려주는 신호가 된다
  if (!def) notFound()

  const t = await getTranslations('tierForm')
  const tGroup = await getTranslations('groupForm')
  const tCat = await getTranslations('categories')
  const tInquiry = await getTranslations('inquiry')

  const currency = currencyForLocale(locale)
  const book = await loadPriceBook(def.no, currency)
  // 미리보기 계산에 쓰는 모델 — 4번 기간 배수는 DB(관리자 설정) 값이다. 결제 화면·주문 생성과
  // 같은 로더를 써야 미리보기와 청구 금액이 갈라지지 않는다
  const model = await loadCategoryModel(def)
  // formFor가 null이면(1·5번) 아래에서 GroupForm 갈래로 안 간다 — 던지지 않는다
  const groupFormDef = formFor(def.no)

  return (
    <main>
      <ImageBand slot={`category-${def.no}`} />

      <Shell as="section">
        <div style={{ padding: '32px 0 64px' }}>
          <h1 style={{ fontSize: 'var(--fs-h1)' }}>{tCat(def.slug)}</h1>

          {def.model.kind === 'tier' ? (
            <TierForm
              book={book}
              model={model}
              locale={locale}
              categorySlug={def.slug}
              country={country}
              purpose={purpose}
              labels={{
                sectionTitle: t('sectionTitle'),
                platformHint: t('platformHint'),
                totalLabel: t('totalLabel'),
                payButton: t('payButton'),
              }}
            />
          ) : groupFormDef ? (
            <GroupForm
              form={groupFormDef}
              model={model}
              book={book}
              locale={locale}
              categorySlug={def.slug}
              country={country}
              purpose={purpose}
              labels={{
                groupTitles: tGroup.raw('groupTitles'),
                itemLabels: tGroup.raw('itemLabels'),
                periods: tGroup.raw('periods'),
                sizeLabel: tGroup('sizeLabel'),
                sizePlaceholder: tGroup('sizePlaceholder'),
                totalLabel: tGroup('totalLabel'),
                payButton: tGroup('payButton'),
                inquiryBadge: tGroup('inquiryBadge'),
                // 기본 포함 안내는 2번(현지 영상 제작)에만 있다 — 선택지가 아니라 안내문이다
                basicIncludedNote: def.no === 2 ? tGroup('basicIncludedNote') : undefined,
              }}
            />
          ) : (
            // 5번은 이번 범위 밖이다 (Q14). 가짜 폼을 만들지 않는다
            <p style={{ color: 'var(--ink-500)' }}>준비 중입니다.</p>
          )}

          <p style={{ marginTop: 48, color: 'var(--ink-500)', fontSize: 'var(--fs-sm)' }}>
            {tInquiry('notice')}
          </p>
        </div>
      </Shell>
    </main>
  )
}
