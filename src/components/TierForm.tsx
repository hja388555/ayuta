'use client'

import { useMemo, useState } from 'react'
import type { RestoreSelection } from '../lib/order-restore'
import { useRouter } from 'next/navigation'
import { calculate, type PriceBook, type PricingModel } from '@ayuta/pricing'
import { ChoiceCard, ChoiceGrid, StepTitle, TotalBar } from './ui'
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
  purpose?: string,
): string {
  const qs = new URLSearchParams()
  for (const t of tiers) qs.append('tier', t)
  for (const p of platforms) qs.append('platform', p)
  for (const c of country) qs.append('country', c)
  if (purpose) qs.set('purpose', purpose)
  return qs.toString()
}

export function formatAmount(amount: number, currency: PriceBook['currency']): string {
  return new Intl.NumberFormat(currency === 'KRW' ? 'ko-KR' : 'ja-JP', {
    style: 'currency',
    currency,
    maximumFractionDigits: 0,
  }).format(amount)
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
  purpose?: string
  restore?: RestoreSelection
  labels: {
    platformTitle: string
    platformHint: string
    platforms: Record<string, string>
    tierTitle: string
    tierHint: string
    contentHead: string
    rows: TierRow[]
    priceRow: string
    /** "{names} 선택" — names 자리에 고른 등급 이름이 들어간다 */
    selected: string
    totalLabel: string
    payButton: string
    notice: string
  }
}

export function TierForm({ book, model, locale, categorySlug, country, purpose, restore, labels }: Props) {
  const router = useRouter()
  // 결제 화면에서 돌아왔으면 고른 등급·플랫폼을 되살린다 — 단가표·플랫폼 목록에 있는 값만
  const [tiers, setTiers] = useState<string[]>(() => [...new Set(restore?.tiers ?? [])].filter((k) => Boolean(book.entries[k])))
  const [platforms, setPlatforms] = useState<string[]>(() => [...new Set(restore?.platforms ?? [])].filter((p) => (PLATFORMS as readonly string[]).includes(p)))

  // 등급 목록은 단가표(book)에서 뽑는다 — model.tiers 는 카테고리 표의 자리표시자일 뿐,
  // 실제로 무엇을 고를 수 있는지는 DB 에 등록된 단가가 결정한다
  const tierOptions = useMemo(() => Object.values(book.entries), [book])
  const total = useMemo(() => previewTotal(book, model, tiers, platforms), [book, model, tiers, platforms])

  const canPay = tiers.length > 0
  const selectedNames = tierOptions.filter((e) => tiers.includes(e.key)).map((e) => e.label)

  function goToPayment() {
    if (!canPay) return
    const query = buildPaymentQuery(tiers, platforms, country, purpose)
    router.push(`/${locale}/order/${categorySlug}/checkout?${query}`)
  }

  const on = (key: string) => (tiers.includes(key) ? s.on : undefined)

  return (
    <>
      <section className={`${s.step} ${s.grid} ${s.platforms}`}>
        <StepTitle n={1} id="tier-platform" title={labels.platformTitle} hint={labels.platformHint} />
        {/* 플랫폼 선택은 금액에 영향이 없다 — 제목 아래에 그대로 안내한다 (G3) */}
        <ChoiceGrid cols={2} labelledBy="tier-platform">
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
        <StepTitle n={2} id="tier-grade" title={labels.tierTitle} hint={labels.tierHint} />
        <div className={s.tableWrap}>
          <table className={s.table} aria-labelledby="tier-grade">
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
        totalLabel={labels.totalLabel}
        sub={selectedNames.length ? labels.selected.replace('{names}', selectedNames.join(' · ')) : undefined}
        amount={formatAmount(total, book.currency)}
        payButton={labels.payButton}
        notice={labels.notice}
        disabled={!canPay}
        onPay={goToPayment}
      />
    </>
  )
}

/** 검정 총액 바 + 파란 결제 버튼 + 안내문. 01~04 가 같은 모양이다 */
export function PaySection({
  totalLabel,
  sub,
  amount,
  payButton,
  notice,
  disabled,
  onPay,
}: {
  totalLabel: string
  sub?: string
  amount: string
  payButton: string
  notice: string
  disabled: boolean
  onPay: () => void
}) {
  return (
    <>
      <div className={s.total} aria-live="polite">
        <TotalBar label={totalLabel} sub={sub} amount={amount} />
      </div>
      <div className={s.pay}>
        <button
          type="button"
          className={`btn btn-primary btn-lg btn-block ${s.payBtn}`}
          disabled={disabled}
          onClick={onPay}
        >
          {payButton}
          <img src="/ui/chevron-white.svg" alt="" width={22} height={22} />
        </button>
        <p className={s.notice}>{notice}</p>
      </div>
    </>
  )
}
