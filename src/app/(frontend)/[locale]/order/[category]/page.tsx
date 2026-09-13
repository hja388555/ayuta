import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { localeAlternates } from '@/lib/seo'
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
  return { title: tCat(def.slug), alternates: localeAlternates(locale, `/order/${def.slug}`) }
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
      {def.no !== 5 ? <ImageBand slot={`category-${def.no}`} locale={locale} /> : null}

      {def.no !== 5 ? (
        <>
          <div className={styles.body}>
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
                  // {n}·{type} 자리는 화면이 채우므로 서식 처리 없이 원문을 넘긴다
                  pairTitle: tGroup.raw('pairTitle') as string,
                  pairsEmpty: tGroup('pairsEmpty'),
                  totalLabel: tGroup('totalLabel'),
                  itemsLabel: tPage('itemsLabel'),
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
                  countryTabs: tGroup.raw('countryTabs'),
                  sizeLabel: tGroup('sizeLabel'),
                  sizePlaceholder: tGroup('sizePlaceholder'),
                  totalLabel: tGroup('totalLabel'),
                  itemsLabel: tPage('itemsLabel'),
                  payButton: tGroup('payButton'),
                  // 기본 포함 칩 · SNS 영상 안내는 2번(현지 영상 제작)에만 있다 — 선택지가 아니라 안내다
                  basicIncludedItems: def.no === 2 ? (tGroup.raw('basicIncludedItems') as string[]) : undefined,
                  shortVideoNote: def.no === 2 ? tGroup('shortVideoNote') : undefined,
                }}
              />
            ) : null}
          </div>
        </>
      ) : (
        <>
          {/* 5번은 금액 없이 문의를 받아 관리자가 견적을 발행한다(Q14 · Q14-B) */}
          <div className={styles.body}>
            <OrderTitle className={styles.title} title={tPage(`titles.${def.slug}`) as string} />
            <InquiryForm
              locale={locale}
              initialType={initialType}
              initialContact={initialContact}
              initialCountry={country}
              labels={{
                countryTitle: tForm('countryTitle'),
                countries: tForm.raw('countries'),
                bodyTitle: tForm('bodyTitle'),
                bodyLabel: tForm('bodyLabel'),
                bodyPlaceholder: tForm('bodyPlaceholder'),
                regionLabel: tForm('regionLabel'),
                regionPlaceholder: tForm('regionPlaceholder'),
                filesDrop: tForm('filesDrop'),
                filesButton: tForm('filesButton'),
                filesHint: tForm('filesHint'),
                contactTitle: tForm('contactTitle'),
                contactHint: tForm('contactHint'),
                name: tForm('name'),
                namePlaceholder: tForm('namePlaceholder'),
                phone: tForm('phone'),
                phonePlaceholder: tForm('phonePlaceholder'),
                email: tForm('email'),
                emailPlaceholder: tForm('emailPlaceholder'),
                consent: tForm('consent'),
                consentView: tForm('consentView'),
                notice: tForm('notice'),
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
