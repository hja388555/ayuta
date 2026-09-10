import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { localeAlternates } from '@/lib/seo'
import { getTranslations, setRequestLocale } from 'next-intl/server'
import { getPayload } from 'payload'
import config from '@payload-config'
import { InquiryForm } from '@/components/InquiryForm'
import { getSessionUser } from '@/lib/dal'
import { Shell } from '@/components/Shell'
import { ImageBand } from '@/components/ImageBand'
import { TierForm } from '@/components/TierForm'
import { GroupForm } from '@/components/GroupForm'
import { CATEGORIES, categoryBySlug } from '@/lib/categories'
import { formFor } from '@/lib/category-groups'
import { loadPriceBook } from '@/lib/price-book'
import { loadCategoryModel } from '@/lib/pricing-model'
import { currencyForLocale } from '@/lib/payments/channel'

export const dynamic = 'force-dynamic'

type Props = {
  params: Promise<{ locale: string; category: string }>
  searchParams: Promise<Record<string, string | string[] | undefined>>
}

// 카테고리 이름을 제목으로, canonical 자기참조 + ko/ja hreflang(큐 Q27). 없는 슬러그는 페이지가 404 로 처리한다
export async function generateMetadata({ params }: Pick<Props, 'params'>): Promise<Metadata> {
  const { locale, category } = await params
  const def = categoryBySlug(category)
  if (!def) return {}
  const tCat = await getTranslations({ locale, namespace: 'categories' })
  return { title: tCat(def.slug), alternates: localeAlternates(locale, `/order/${def.slug}`) }
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
  const tForm = await getTranslations('inquiryForm')

  // 5번 문의 폼: ?type= 은 URL 에서 온 값이라 카테고리 표와 대조한다. 없는 값이면 미선택(1-18).
  // 받은 문자열을 화면에 그대로 그리지 않는다 — 대조를 통과한 슬러그만 넘긴다
  const rawType = typeof sp.type === 'string' ? sp.type : ''
  const initialType = def.no === 5 && rawType ? (categoryBySlug(rawType)?.slug ?? null) : null
  // 로그인 상태면 연락처 자동 채움(checkout 과 같은 방식). 고객이 고칠 수 있다
  let initialContact: { name?: string; phone?: string; email?: string } | undefined
  if (def.no === 5) {
    const sessionUser = await getSessionUser()
    if (sessionUser) {
      const payload = await getPayload({ config })
      const u = await payload.findByID({ collection: 'users', id: sessionUser.id, overrideAccess: true, depth: 0 })
      initialContact = { name: u.name as string, phone: u.phone as string, email: u.email as string }
    }
  }

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
            // 5번 — 금액이 없다. 문의를 받아 관리자가 견적을 발행한다(Q14 · Q14-B)
            <>
              <p style={{ color: 'var(--ink-500)' }}>{tForm('intro')}</p>
              <InquiryForm
                locale={locale}
                types={CATEGORIES.map((c) => ({ slug: c.slug, label: tCat(c.slug) }))}
                initialType={initialType}
                initialContact={initialContact}
                labels={{
                  typeLabel: tForm('typeLabel'),
                  typeNone: tForm('typeNone'),
                  bodyLabel: tForm('bodyLabel'),
                  bodyPlaceholder: tForm('bodyPlaceholder'),
                  regionLabel: tForm('regionLabel'),
                  filesLabel: tForm('filesLabel'),
                  filesHint: tForm('filesHint'),
                  contactTitle: tForm('contactTitle'),
                  name: tForm('name'),
                  phone: tForm('phone'),
                  email: tForm('email'),
                  submit: tForm('submit'),
                  submitting: tForm('submitting'),
                  done: tForm('done'),
                  errors: tForm.raw('errors'),
                }}
              />
            </>
          )}

          {def.no !== 5 ? (
            // 요구사항 1-18 — 상담신청 버튼이 놓인 자리가 곧 문의 유형이다
            <section style={{ marginTop: 48, paddingTop: 24, borderTop: '1px solid var(--ink-100, #ECEEF1)' }}>
              <p style={{ margin: 0 }}>{tForm('consultTitle')}</p>
              <Link href={`/${locale}/order/other?type=${def.slug}`} style={{ display: 'inline-block', marginTop: 8 }}>
                {tForm('consultCta')}
              </Link>
            </section>
          ) : null}

          <p style={{ marginTop: 48, color: 'var(--ink-500)', fontSize: 'var(--fs-sm)' }}>
            {tInquiry('notice')}
          </p>
        </div>
      </Shell>
    </main>
  )
}
