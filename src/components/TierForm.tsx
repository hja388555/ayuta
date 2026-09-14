'use client'

import { useMemo, useState } from 'react'
import type { RestoreSelection } from '../lib/order-restore'
import { useCheckoutGuard, useMirrorQuery } from '../lib/order-url'
import { useRouter } from 'next/navigation'
import { calculate, type PriceBook, type PricingModel } from '@ayuta/pricing'
import { ChoiceCard, ChoiceGrid } from './ui'
import { LegalConsentModal } from './LegalConsentModal'
import s from './OrderForms.module.css'

const PLATFORMS = ['instagram', 'youtube', 'tiktok', 'line'] as const

/** 체크박스 토글. 원본 배열을 바꾸지 않는다 — 리액트 상태를 제자리에서 고치면 리렌더가 안 된다 */
export function toggleValue(list: readonly string[], v: string): string[] {
  return list.includes(v) ? list.filter((x) => x !== v) : [...list, v]
}

/**
 * 화면에 보여줄 금액. 서버가 청구할 금액과 **같은 함수**로 계산한다.
 * 계산이 실패하면 0 을 보여준다 — 틀린 금액을 보여주는 것보다 낫다.
 */
export function previewTotal(
  book: PriceBook,
  model: PricingModel,
  tiers: readonly string[],
  platforms: readonly string[],
): number {
  const r = calculate(model, book, { tiers: [...tiers], platforms: [...platforms] })
  return r.ok ? r.total : 0
}

/**
 * 결제 화면으로 넘길 쿼리스트링을 만든다.
 * 금액은 절대 포함하지 않는다 — 서버가 DB 단가로 다시 계산한 값만 청구한다.
 * 선택한 등급과 플랫폼만 repeated param으로 담는다.
 * country·purpose는 표지에서 이미 고른 값을 그대로 실어 보낸다 — 이 화면에서 다시
 * 고르게 하지 않는다(카테고리 화면은 표지 다음 단계일 뿐이다).
 */
export function buildPaymentQuery(
  tiers: readonly string[],
  platforms: readonly string[],
  country: readonly string[] = [],
  purposes: readonly string[] = [],
): string {
  const qs = new URLSearchParams()
  for (const t of tiers) qs.append('tier', t)
  for (const p of platforms) qs.append('platform', p)
  for (const c of country) qs.append('country', c)
  for (const p of purposes) qs.append('purpose', p)
  return qs.toString()
}

export function formatAmount(amount: number, currency: PriceBook['currency']): string {
  return new Intl.NumberFormat(currency === 'KRW' ? 'ko-KR' : 'ja-JP', {
    style: 'currency',
    currency,
    maximumFractionDigits: 0,
  }).format(amount)
}

/** 상품 내용 목록. 플랫폼은 쉼표로 이은 한 줄, 등급은 한 줄씩 */
export function tierSummaryItems(platformLabels: readonly string[], tierLabels: readonly string[]): string[] {
  return [...(platformLabels.length ? [platformLabels.join(' / ')] : []), ...tierLabels]
}

const TIER_ORDER = ['basic', 'standard', 'premium']

/** 표 열 순서: 베이직 → 스탠다드 → 프리미엄, 모르는 키는 뒤로 */
export function orderTiers<T extends { key: string }>(entries: readonly T[]): T[] {
  const rank = (key: string) => {
    const i = TIER_ORDER.indexOf(key)
    return i === -1 ? TIER_ORDER.length : i
  }
  return [...entries].sort((a, b) => rank(a.key) - rank(b.key))
}

/** 비교표의 한 행. 등급 키(basic/standard/premium) → 칸 문구 */
export type TierRow = { label: string } & Record<string, string>

type Props = {
  book: PriceBook
  model: PricingModel
  locale: string
  categorySlug: string
  // 표지에서 이미 고른 나라·목적. 여기서는 그대로 들고만 간다
  country: readonly string[]
  purposes: readonly string[]
  restore?: RestoreSelection
  labels: {
    platformTitle: string
    platforms: Record<string, string>
    contentHead: string
    rows: TierRow[]
    priceRow: string
    totalLabel: string
    itemsLabel: string
    payButton: string
    termsLink: string
  }
}

export function TierForm({ book, model, locale, categorySlug, country, purposes, restore, labels }: Props) {
  const router = useRouter()
  const { pending, goToCheckout } = useCheckoutGuard()
  // 결제 화면에서 돌아왔으면 고른 등급·플랫폼을 되살린다 — 단가표·플랫폼 목록에 있는 값만
  const [tiers, setTiers] = useState<string[]>(() => [...new Set(restore?.tiers ?? [])].filter((k) => Boolean(book.entries[k])))
  const [platforms, setPlatforms] = useState<string[]>(() => [...new Set(restore?.platforms ?? [])].filter((p) => (PLATFORMS as readonly string[]).includes(p)))

  // 등급 목록은 단가표(book)에서 뽑는다 — model.tiers 는 카테고리 표의 자리표시자일 뿐,
  // 실제로 무엇을 고를 수 있는지는 DB 에 등록된 단가가 결정한다
  // 표 열 순서는 베이직 → 스탠다드 → 프리미엄(Figma). book.entries 는 DB 순서라 그대로 쓰면 뒤집힌다
  const tierOptions = useMemo(() => orderTiers(Object.values(book.entries)), [book])
  const total = useMemo(() => previewTotal(book, model, tiers, platforms), [book, model, tiers, platforms])

  const canPay = tiers.length > 0
  const selectedNames = tierOptions.filter((e) => tiers.includes(e.key)).map((e) => e.label)
  const platformNames = platforms.map((p) => labels.platforms[p] ?? p)
  const items = tierSummaryItems(platformNames, selectedNames)

  // 고른 내용을 주소에 옮겨 적는다 — 새로고침·언어 전환 뒤에도 restore 로 되살아난다
  const query = buildPaymentQuery(tiers, platforms, country, purposes)
  useMirrorQuery(query)

  function goToPayment() {
    if (!canPay) return
    goToCheckout(router, `/${locale}/order/${categorySlug}`, query, `/${locale}/order/${categorySlug}/checkout?${query}`)
  }

  const on = (key: string) => (tiers.includes(key) ? s.on : undefined)

  return (
    <>
      <section className={`${s.step} ${s.grid} ${s.platforms}`}>
        {/* v3: 제목·안내문 없이 카드만 보여준다. 스크린리더용 레이블은 aria-label 로 남긴다 */}
        <ChoiceGrid cols={2} ariaLabel={labels.platformTitle}>
          {PLATFORMS.map((p) => (
            <ChoiceCard
              key={p}
              type="checkbox"
              checked={platforms.includes(p)}
              onChange={() => setPlatforms((prev) => toggleValue(prev, p))}
            >
              {labels.platforms[p] ?? p}
            </ChoiceCard>
          ))}
        </ChoiceGrid>
      </section>

      <section className={s.step}>
        <div className={s.tableWrap}>
          <table className={s.table} aria-label={labels.contentHead}>
            <colgroup>
              <col />
              {tierOptions.map((e) => (
                <col key={e.key} />
              ))}
            </colgroup>
            <thead>
              <tr>
                <th scope="col">{labels.contentHead}</th>
                {tierOptions.map((e) => (
                  <th key={e.key} scope="col" className={on(e.key)}>
                    <label className={s.tierPick}>
                      <input
                        type="checkbox"
                        checked={tiers.includes(e.key)}
                        onChange={() => setTiers((prev) => toggleValue(prev, e.key))}
                      />
                      <span className={s.tierBox} aria-hidden />
                      {e.label}
                    </label>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {labels.rows.map((row) => (
                <tr key={row.label}>
                  <td>{row.label}</td>
                  {tierOptions.map((e) => (
                    <td key={e.key} className={on(e.key)}>
                      {row[e.key] ?? ''}
                    </td>
                  ))}
                </tr>
              ))}
              <tr className={s.priceRow}>
                <td>{labels.priceRow}</td>
                {tierOptions.map((e) => (
                  <td key={e.key} className={on(e.key)}>
                    {formatAmount(e.amount, book.currency)}
                  </td>
                ))}
              </tr>
            </tbody>
          </table>
        </div>
      </section>

      <PaySection
        locale={locale}
        totalLabel={labels.totalLabel}
        itemsLabel={labels.itemsLabel}
        items={items}
        amount={formatAmount(total, book.currency)}
        payButton={labels.payButton}
        termsLink={labels.termsLink}
        disabled={!canPay || pending}
        onPay={goToPayment}
      />
    </>
  )
}

/** 상품 내용 목록 + 총액 바 + [이용약관] + 결제 버튼. 01~04 가 같은 모양이다 */
export function PaySection({
  locale,
  totalLabel,
  itemsLabel,
  items,
  amount,
  payButton,
  termsLink,
  disabled,
  onPay,
}: {
  locale: string
  totalLabel: string
  itemsLabel: string
  items: string[]
  amount: string
  payButton: string
  termsLink: string
  disabled: boolean
  onPay: () => void
}) {
  const [showTerms, setShowTerms] = useState(false)
  return (
    <div className={s.pay}>
      {/* 상품 내용 + 총액을 브라운 박스 하나로 합쳤다(2026-09-14 4라운드) */}
      <div className={s.totalBox} aria-live="polite">
        {items.length > 0 ? (
          <div className={s.totalItems}>
            <p className={s.itemsLabel}>{itemsLabel}</p>
            <ul>
              {items.map((it, i) => (
                <li key={`${i}-${it}`}>{it}</li>
              ))}
            </ul>
          </div>
        ) : null}
        <div className={s.totalRow}>
          <span className={s.totalRowLabel}>{totalLabel}</span>
          <span className={s.totalRowAmount}>{amount}</span>
        </div>
      </div>
      {/* 결제 전 이용약관을 미리 볼 수 있게 — 여기서는 보기만, 동의 체크는 없다(2026-09-14 3라운드) */}
      <button type="button" className={s.termsLink} onClick={() => setShowTerms(true)}>
        {termsLink}
      </button>
      <button type="button" className={`btn btn-primary btn-block ${s.payBtn}`} disabled={disabled} onClick={onPay}>
        {payButton}
        <span className="icon-mask" style={{ width: 18, height: 18, ['--icon-url' as string]: "url('/ui/chevron.svg')" }} aria-hidden />
      </button>
      {showTerms ? <LegalConsentModal kind="terms" locale={locale} onClose={() => setShowTerms(false)} onAgree={() => {}} /> : null}
    </div>
  )
}
