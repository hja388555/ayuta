import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { localeAlternates } from '@/lib/seo'
import { JsonLd, serviceJsonLd } from '@/components/JsonLd'
import { getTranslations, setRequestLocale } from 'next-intl/server'
import { getPayload } from 'payload'
import config from '@payload-config'
import { InquiryForm } from '@/components/InquiryForm'
import { getSessionUser } from '@/lib/dal'
import { ImageBand } from '@/components/ImageBand'
import { TierForm } from '@/components/TierForm'
import { GroupForm } from '@/components/GroupForm'
import { restoreFromQuery } from '@/lib/order-restore'
import { VideoPairsForm } from '@/components/VideoPairsForm'
import type { TierRow } from '@/components/TierForm'
import styles from '@/components/OrderForms.module.css'
import { categoryBySlug } from '@/lib/categories'
import { formFor } from '@/lib/category-groups'
import { loadServiceForm } from '@/lib/services/load'
import { loadPriceBook } from '@/lib/price-book'
import { loadCategoryModel } from '@/lib/pricing-model'
import { currencyForLocale } from '@/lib/payments/channel'
import { sanitizePurposes } from '@/lib/cover-selection'

export const dynamic = 'force-dynamic'

/**
 * 제목 끝의 괄호 문구가 모바일에서 줄 중간에 꺾이지 않게 한다("...선택\n가능)" 같은 고아 방지).
 * " (" 앞에서만 나눠 앞 문구<wbr/>괄호 문구로 렌더링한다 — 괄호가 없는 제목은 그대로 보여준다
 */
function OrderTitle({ title, className }: { title: string; className?: string }) {
  const i = title.indexOf(' (')
  if (i === -1) return <h1 className={className}>{title}</h1>
  return (
    <h1 className={className}>
      {title.slice(0, i)}
      <wbr />
      <span className={styles.titleParen}>{title.slice(i + 1)}</span>
    </h1>
  )
}

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
  const tSeo = await getTranslations({ locale, namespace: 'seo' })
  // 설명은 카테고리마다 다르게 — 다섯 화면이 표지 설명을 같이 쓰면 검색 엔진이 중복으로 본다
  const description = tSeo(`categories.${def.slug}`)
  return {
    title: tCat(def.slug),
    description,
    openGraph: { title: tCat(def.slug), description },
    alternates: localeAlternates(locale, `/order/${def.slug}`),
  }
}

export default async function OrderPage({ params, searchParams }: Props) {
  const { locale, category } = await params
  const sp = await searchParams
  setRequestLocale(locale)

  // 표지에서 넘어온 나라·목적. 여기서는 다시 고르게 하지 않고 결제 화면까지 그대로 들고 간다
  const country = Array.isArray(sp.country) ? sp.country : sp.country ? [sp.country] : []
  const purposes = sanitizePurposes(Array.isArray(sp.purpose) ? sp.purpose : sp.purpose ? [sp.purpose] : [])
  // 결제 화면 "선택 내용 수정하기"로 돌아오면 같은 쿼리가 실려 온다 — 폼이 고른 내용을 되살린다
  const restore = restoreFromQuery(sp)

  const def = categoryBySlug(category)
  // 없는 슬러그는 404. 500 이 나면 어떤 슬러그가 존재하는지 알려주는 신호가 된다
  if (!def) notFound()

  const t = await getTranslations('tierForm')
  const tGroup = await getTranslations('groupForm')
  const tCat = await getTranslations('categories')
  const tForm = await getTranslations('inquiryForm')
  const tPage = await getTranslations('orderPage')
  const tCover = await getTranslations('cover')
  const tSeo = await getTranslations('seo')
  const tTabs = await getTranslations('tabs')

  // 우측 견적 패널 맨 위 참고 줄 — 표지에서 고른 나라·목적을 금액 없이 되짚어 준다
  const countryLabels: Record<string, string> = tCover.raw('countries')
  const purposeLabels: Record<string, string> = tCover.raw('purposes')
  const quoteLabels = {
    head: tPage('quote.head'),
    empty: tPage('quote.empty'),
    refs: [
      ...(country.length > 0 ? [{ label: tPage('quote.country'), amount: country.map((c) => countryLabels[c] ?? c).join(', ') }] : []),
      ...(purposes.length > 0 ? [{ label: tPage('quote.purpose'), amount: purposes.map((p) => purposeLabels[p] ?? p).join(', ') }] : []),
    ],
  }

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
  // 묶음·항목 정의는 DB(ad-service-groups + price-entries)가 먼저다(2026-09-16). 아직 안 심겼으면
  // 기존 상수로 떨어진다 — 전환 도중에도 화면이 멈추지 않게. formFor 가 null 이면(1·5번)
  // 아래에서 GroupForm 갈래로 안 간다 — 던지지 않는다
  const groupFormDef = (await loadServiceForm(def.no)) ?? formFor(def.no)

  return (
    <main>
      {serviceJsonLd(locale, def.slug, tCat(def.slug), tSeo(`categories.${def.slug}`), tTabs('home')).map((d, i) => (
        <JsonLd key={i} data={d} />
      ))}
      {def.no !== 5 ? <ImageBand slot={`category-${def.no}`} locale={locale} /> : null}

      {def.no !== 5 ? (
        <>
          <div className={def.no === 3 || def.no === 4 ? `${styles.body} ${styles.bodyWide}` : styles.body}>
            <OrderTitle className={styles.title} title={tPage(`titles.${def.slug}`) as string} />
            {def.model.kind === 'tier' ? (
              <TierForm
                book={book}
                model={model}
                locale={locale}
                categorySlug={def.slug}
                country={country}
                purposes={purposes}
                restore={restore}
                labels={{
                  platformTitle: t('platformTitle'),
                  platforms: t.raw('platforms'),
                  contentHead: t('contentHead'),
                  rows: t.raw('rows') as TierRow[],
                  priceRow: t('priceRow'),
                  totalLabel: t('totalLabel'),
                  itemsLabel: tPage('itemsLabel'),
                  quote: quoteLabels,
                  payButton: t('payButton'),
                }}
              />
            ) : def.model.kind === 'videoPairs' && groupFormDef ? (
              <VideoPairsForm
                form={groupFormDef}
                model={model}
                book={book}
                locale={locale}
                categorySlug={def.slug}
                country={country}
                purposes={purposes}
                restore={restore}
                labels={{
                  groupTitles: tGroup.raw('groupTitles'),
                  groupHints: tGroup.raw('groupHints'),
                  itemLabels: tGroup.raw('itemLabels'),
                  totalLabel: tGroup('totalLabel'),
                  itemsLabel: tPage('itemsLabel'),
                  quote: quoteLabels,
                  payButton: tGroup('payButton'),
                  basicIncludedItems: tGroup.raw('basicIncludedItems') as string[],
                  shortVideoNote: tGroup('shortVideoNote'),
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
                purposes={purposes}
                restore={restore}
                labels={{
                  groupTitles: tGroup.raw('groupTitles'),
                  groupHints: tGroup.raw('groupHints'),
                  itemLabels: tGroup.raw('itemLabels'),
                  periods: tGroup.raw('periods'),
                  countries: tGroup.raw('countries'),
                  sizeLabel: tGroup('sizeLabel'),
                  sizePlaceholder: tGroup('sizePlaceholder'),
                  totalLabel: tGroup('totalLabel'),
                  itemsLabel: tPage('itemsLabel'),
                  quote: quoteLabels,
                  payButton: tGroup('payButton'),
                  // 기본 포함 칩 · SNS 영상 안내는 2번(현지 영상 제작)에만 있다 — 선택지가 아니라 안내다
                  basicIncludedItems: def.no === 2 ? (tGroup.raw('basicIncludedItems') as string[]) : undefined,
                  shortVideoNote: def.no === 2 ? tGroup('shortVideoNote') : undefined,
                  // 3번 블로그 설명·지역 커뮤니티 괄호 문구는 groupForm 쪽에서만 쓰인다
                  itemDescriptions: def.no === 3 ? (tGroup.raw('itemDescriptions') as Record<string, string>) : undefined,
                  // 포스터 사이즈 안내는 4번에만 있다
                  posterNote: def.no === 4 ? tGroup('posterNote') : undefined,
                }}
              />
            ) : null}
          </div>
        </>
      ) : (
        <>
          {/* 5번은 금액 없이 문의를 받아 관리자가 견적을 발행한다(Q14 · Q14-B). PC 는 가운데 760 한 칸 */}
          <div className={`${styles.body} ${styles.bodyNarrow}`}>
            <OrderTitle className={styles.title} title={tPage(`titles.${def.slug}`) as string} />
            <InquiryForm
              locale={locale}
              initialType={initialType}
              initialContact={initialContact}
              initialCountry={country}
              labels={{
                lead: tForm('lead'),
                countries: tForm.raw('countries'),
                countryAria: tForm('countryAria'),
                bodyLabel: tForm('bodyLabel'),
                bodyPlaceholder: tForm('bodyPlaceholder'),
                regionLabel: tForm('regionLabel'),
                regionPlaceholder: tForm('regionPlaceholder'),
                filesTitle: tForm('filesTitle'),
                filesButton: tForm('filesButton'),
                name: tForm('name'),
                namePlaceholder: tForm('namePlaceholder'),
                phone: tForm('phone'),
                phonePlaceholder: tForm('phonePlaceholder'),
                email: tForm('email'),
                emailPlaceholder: tForm('emailPlaceholder'),
                consent: tForm('consent'),
                consentView: tForm('consentView'),
                submit: tForm('submit'),
                submitting: tForm('submitting'),
                done: tForm('done'),
                errors: tForm.raw('errors'),
              }}
            />
          </div>
        </>
      )}
    </main>
  )
}
