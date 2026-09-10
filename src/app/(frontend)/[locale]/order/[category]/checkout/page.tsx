import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { NO_INDEX } from '@/lib/seo'
import { getTranslations, setRequestLocale } from 'next-intl/server'
import { getPayload } from 'payload'
import config from '@payload-config'
import { calculate, fillContract } from '@ayuta/pricing'
import { Shell } from '@/components/Shell'
import { CheckoutForm } from '@/components/CheckoutForm'
import { categoryBySlug } from '@/lib/categories'
import { formFor } from '@/lib/category-groups'
import { loadPriceBook } from '@/lib/price-book'
import { loadCategoryModel } from '@/lib/pricing-model'
import { currencyForLocale } from '@/lib/payments/channel'
import { selectionFromQuery, filterPricedSelection } from '@/lib/checkout/selection-from-query'
import { buildContractItems, countryFactValue } from '@/lib/checkout/contract-items'
import { loadCompanyContractFields } from '@/lib/company-settings'
import { getSessionUser } from '@/lib/dal'

export const dynamic = 'force-dynamic'
// 결제 화면은 선택값이 쿼리에 실린 개인 화면이다 — 검색에 올리지 않는다(robots.ts 와 두 겹)
export const metadata: Metadata = { robots: NO_INDEX }

type Props = {
  params: Promise<{ locale: string; category: string }>
  searchParams: Promise<Record<string, string | string[] | undefined>>
}

export default async function CheckoutPage({ params, searchParams }: Props) {
  const { locale, category } = await params
  const sp = await searchParams
  setRequestLocale(locale)

  const def = categoryBySlug(category)
  // 없는 슬러그는 404. 500 이 나면 어떤 슬러그가 존재하는지 알려주는 신호가 된다
  if (!def) notFound()

  const t = await getTranslations('checkout')
  const currency = currencyForLocale(locale)
  const book = await loadPriceBook(def.no, currency)

  const form = formFor(def.no)
  // 4번 기간 배수 등 관리자가 DB 에서 고치는 값을 채운 모델 — 견적 화면·주문 생성과 같은 로더
  const model = await loadCategoryModel(def)
  const rawSelection = selectionFromQuery(model, sp)
  // calculate()에는 금액칸이 있는 선택만 넘긴다. 계약서·화면에는 원본 선택(rawSelection)을
  // 그대로 쓴다 — priced 필터는 계산 한 곳에서만 걸어야 국가·사이즈 같은 무료 선택이
  // 계약서에서 사라지지 않는다(C1)
  const pricedSelection = filterPricedSelection(model, form, rawSelection)
  const quote = calculate(model, book, pricedSelection)
  // 이전 화면에서 넘어온 선택이 이제 와서 유효하지 않다(단가 없음, 등급 미선택 등) —
  // 견적 화면으로 되돌아가는 게 맞지만, 지금은 500 대신 404 로 막는다(등록 안 된 슬러그와
  // 같은 이유: 어느 지점에서 실패했는지 이상의 정보를 공격자에게 주지 않는다)
  if (!quote.ok) notFound()

  const payload = await getPayload({ config })
  const { docs: templates } = await payload.find({
    collection: 'contract-templates',
    where: { and: [{ category: { equals: def.no } }, { locale: { equals: locale } }, { active: { equals: true } }] },
    limit: 1,
    overrideAccess: true,
  })
  const template = templates[0]

  // 계약서 템플릿이 없거나 내려 둔(active:false) 카테고리는 결제로 진행하지 못한다 — 근거 문서 없는 계약을 만들지 않는다
  if (!template) {
    return (
      <main>
        <Shell as="section">
          <div style={{ padding: '32px 0 64px' }}>
            <h1 style={{ fontSize: 'var(--fs-h1)' }}>{t('noContractTitle')}</h1>
            <p style={{ marginTop: 12, color: 'var(--ink-500)' }}>{t('noContractBody')}</p>
            {/* 1:1 문의 화면은 이 계획 밖이다(Q14) — 지금은 안내 문구만 노출하고 결제로 보내지 않는다 */}
            <a href={`/${locale}/order/other?type=${def.slug}`} style={{ display: 'inline-block', marginTop: 24 }}>
              {t('inquiryLink')}
            </a>
          </div>
        </Shell>
      </main>
    )
  }

  const sessionUser = await getSessionUser()
  const payloadUser = sessionUser
    ? await payload.findByID({ collection: 'users', id: sessionUser.id, overrideAccess: true }).catch(() => null)
    : null

  const contractDate = new Intl.DateTimeFormat('ko-KR', {
    timeZone: 'Asia/Seoul',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  }).format(new Date())

  // 미리보기 전문 — 주문자 이름·서명은 아직 입력 전이라 비워 둔다. 실제로 저장되는
  // 전문은 createOrder 가 주문자 입력을 받은 뒤 다시 채운다. 여기서 missing 을 막지
  // 않는 이유도 그래서다: 이건 결제를 확정하는 계약서가 아니라 미리 읽어 보는 사본이다
  const contractLocale = locale === 'ja' ? 'ja' : 'ko'
  const preview = fillContract(template.body as string, {
    amount: quote.total,
    currency,
    contractDate,
    buyerName: '',
    signature: '',
    items: buildContractItems(def, book, rawSelection, contractLocale),
    country: countryFactValue(rawSelection, contractLocale),
    ...(await loadCompanyContractFields(contractLocale)),
  })

  return (
    <main>
      <Shell as="section">
        <div style={{ padding: '32px 0 64px' }}>
          <h1 style={{ fontSize: 'var(--fs-h1)' }}>{t('title')}</h1>
          <CheckoutForm
            locale={locale}
            categorySlug={def.slug}
            selection={rawSelection}
            amount={quote.total}
            currency={currency}
            lines={quote.lines.map((l) => ({ label: l.label, amount: l.amount }))}
            template={{
              title: template.title as string,
              body: preview.text,
              consents: (template.consents as { key: string; label: string; required: boolean }[]) ?? [],
            }}
            initialOrderer={
              payloadUser
                ? {
                    name: payloadUser.name as string,
                    phone: payloadUser.phone as string,
                    email: payloadUser.email as string,
                    postalCode: payloadUser.postalCode as string,
                    address1: payloadUser.address1 as string,
                    address2: (payloadUser.address2 as string) ?? '',
                    businessNo: (payloadUser.businessNo as string) ?? '',
                  }
                : undefined
            }
            labels={{
              title: t('title'),
              summaryTitle: t('summaryTitle'),
              totalLabel: t('totalLabel'),
              ordererTitle: t('ordererTitle'),
              name: t('name'),
              phone: t('phone'),
              email: t('email'),
              postalCode: t('postalCode'),
              address1: t('address1'),
              address2: t('address2'),
              businessNo: t('businessNo'),
              representative: t('representative'),
              contractTitle: t('contractTitle'),
              viewContract: t('viewContract'),
              signatureLabel: t('signatureLabel'),
              signatureNote: t('signatureNote'),
              payButton: t('payButton'),
              submitting: t('submitting'),
              errorGeneric: t('errorGeneric'),
            }}
          />
        </div>
      </Shell>
    </main>
  )
}
