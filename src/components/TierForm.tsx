'use client'

import { useMemo, useState } from 'react'
import type { RestoreSelection } from '../lib/order-restore'
import { useCheckoutGuard, useMirrorQuery } from '../lib/order-url'
import { useRouter } from 'next/navigation'
import { calculate, type PriceBook, type PricingModel } from '@ayuta/pricing'
import { ChoiceCard, ChoiceGrid } from './ui'
import s from './OrderForms.module.css'

const PLATFORMS = ['instagram', 'youtube', 'tiktok', 'line'] as const

/** 체크박스 토글. 원본 배열을 바꾸지 않는다 — 리액트 상태를 제자리에서 고치면 리렌더가 안 된다 */
export function toggleValue(list: readonly string[], v: string): string[] {
  return list.includes(v) ? list.filter((x) => x !== v) : [...list, v]
}

/** 우측 패널에 한 줄로 적히는 항목. 금액이 없는 줄(표지에서 고른 나라·목적)은 amount 가 없다 */
export type QuoteRow = { label: string; amount?: string }

/**
 * 화면에 보여줄 견적. 서버가 청구할 금액과 **같은 함수**로 계산한다.
 * 계산이 실패하면 빈 견적을 보여준다 — 틀린 금액을 보여주는 것보다 낫다.
 */
export function previewQuote(
  book: PriceBook,
  model: PricingModel,
  tiers: readonly string[],
  platforms: readonly string[],
): { total: number; rows: QuoteRow[] } {
  return toQuote(calculate(model, book, { tiers: [...tiers], platforms: [...platforms] }), book.currency)
}

/** 계산 결과를 패널 줄로 옮긴다. 라벨은 계산기가 단가표에서 통화에 맞는 언어로 골라 둔 값이다 */
export function toQuote(
  r: ReturnType<typeof calculate>,
  currency: PriceBook['currency'],
): { total: number; rows: QuoteRow[] } {
  if (!r.ok) return { total: 0, rows: [] }
  // 0원 줄(광고 기간 같은 배수 항목)은 금액칸을 비운다 — ₩0 을 적으면 공짜로 읽힌다
  return {
    total: r.total,
    rows: r.lines.map((l) => ({ label: l.label, amount: l.amount > 0 ? formatAmount(l.amount, currency) : undefined })),
  }
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
    quote: QuoteLabels
    payButton: string
  }
}

export function TierForm({ book, model, locale, categorySlug, country, purposes, restore, labels }: Props) {
  const router = useRouter()
  const { pending, goToCheckout } = useCheckoutGuard()
  // 결제 화면에서 돌아왔으면 고른 등급·플랫폼을 되살린다 — 단가표·플랫폼 목록에 있는 값만
  const [tiers, setTiers] = useState<string[]>(() => [...new Set(restore?.tiers ?? [])].filter((k) => Boolean(book.entries[k])))
  const [platforms, setPlatforms] = useState<string[]>(() => [...new Set(restore?.platforms ?? [])].filter((p) => (PLATFORMS as readonly string[]).includes(p)))

  // 등급 목록은 단가표(book)에서 뽑되 등급 키만 고른다.
  // 단가표는 카테고리 단위라 같은 카테고리에 등급이 아닌 행(플랫폼 등)이 들어오면 그것까지
  // 표 열이 된다 — 2026-09-16 에 플랫폼 4개를 카테고리 1 에 심자 표가 7열로 늘어나 깨졌다.
  // 표 열 순서는 베이직 → 스탠다드 → 프리미엄(Figma). book.entries 는 DB 순서라 그대로 쓰면 뒤집힌다
  const tierOptions = useMemo(
    () => orderTiers(Object.values(book.entries).filter((e) => (TIER_ORDER as readonly string[]).includes(e.key))),
    [book],
  )
  const quote = useMemo(() => previewQuote(book, model, tiers, platforms), [book, model, tiers, platforms])

  const canPay = tiers.length > 0
  const selectedNames = tierOptions.filter((e) => tiers.includes(e.key)).map((e) => e.label)
  const items = tierSummaryItems(platforms.map((pf) => labels.platforms[pf] ?? pf), selectedNames)

  // 고른 내용을 주소에 옮겨 적는다 — 새로고침·언어 전환 뒤에도 restore 로 되살아난다
  const query = buildPaymentQuery(tiers, platforms, country, purposes)
  useMirrorQuery(query)

  function goToPayment() {
    if (!canPay) return
    goToCheckout(router, `/${locale}/order/${categorySlug}`, query, `/${locale}/order/${categorySlug}/checkout?${query}`)
  }

  const on = (key: string) => (tiers.includes(key) ? s.on : undefined)

  return (
    // PC 는 왼쪽 740(선택) | 오른쪽 420(결제 패널) 두 칸. 모바일은 두 감싸개가 display: contents 라 기존 배치 그대로
    <div className={s.split}>
      <div className={s.choices}>
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
      </div>
      <PaySection
        totalLabel={labels.totalLabel}
        itemsLabel={labels.itemsLabel}
        items={items}
        quote={labels.quote}
        rows={quote.rows}
        amount={formatAmount(quote.total, book.currency)}
        payButton={labels.payButton}
        disabled={!canPay || pending}
        onPay={goToPayment}
      />
    </div>
  )
}

/** 우측 패널 문구. 표지에서 고른 나라·목적은 금액 없는 참고 줄로 앞에 붙는다 */
export type QuoteLabels = { head: string; empty: string; refs: QuoteRow[] }

/** 견적서 + 총액 바 + 결제 버튼. 01~04 가 같은 모양이다 */
export function PaySection({
  totalLabel,
  itemsLabel,
  items,
  quote,
  rows,
  amount,
  payButton,
  disabled,
  onPay,
}: {
  totalLabel: string
  itemsLabel: string
  items: string[]
  quote: QuoteLabels
  rows: QuoteRow[]
  amount: string
  payButton: string
  disabled: boolean
  onPay: () => void
}) {
  return (
    <div className={s.pay}>
      {/* PC 우측 패널만 견적서로 쌓아 보여준다(2026-09-18) — 모바일은 기존 「상품 내용 :」 한 줄 그대로다 */}
      <div className={s.quote} aria-live="polite">
        <p className={s.quoteHead}>{quote.head}</p>
        {quote.refs.map((r) => (
          <div key={r.label} className={s.quoteRow}>
            <span className={s.quoteLabel}>{r.label}</span>
            <span className={s.quoteValue}>{r.amount}</span>
          </div>
        ))}
        <div className={s.quoteLines}>
          {rows.length > 0 ? (
            rows.map((r) => (
              <div key={r.label} className={s.quoteRow}>
                <span className={s.quoteItem}>{r.label}</span>
                <span className={s.quoteAmount}>{r.amount}</span>
              </div>
            ))
          ) : (
            <p className={s.quoteEmpty}>{quote.empty}</p>
          )}
        </div>
      </div>
      <div className={s.totalBox} aria-live="polite">
        {items.length > 0 ? (
          <div className={s.itemsRow}>
            <span className={s.itemsLabel}>{itemsLabel}</span>
            <span className={s.itemsValue}>{items.join(', ')}</span>
          </div>
        ) : null}
        <div className={s.totalRow}>
          <span className={s.totalRowLabel}>{totalLabel}</span>
          <span className={s.totalRowAmount}>{amount}</span>
        </div>
      </div>
      <button type="button" className={`btn btn-primary btn-block ${s.payBtn}`} disabled={disabled} onClick={onPay}>
        {payButton}
        <span className="icon-mask" style={{ width: 56, height: 56, ['--icon-url' as string]: "url('/ui/chevron.svg')" }} aria-hidden />
      </button>
    </div>
  )
}
