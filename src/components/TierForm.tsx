'use client'

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { calculate, type PriceBook, type PricingModel } from '@ayuta/pricing'

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
 */
export function buildPaymentQuery(tiers: readonly string[], platforms: readonly string[]): string {
  const qs = new URLSearchParams()
  for (const t of tiers) qs.append('tier', t)
  for (const p of platforms) qs.append('platform', p)
  return qs.toString()
}

function formatAmount(amount: number, currency: PriceBook['currency']): string {
  return new Intl.NumberFormat(currency === 'KRW' ? 'ko-KR' : 'ja-JP', {
    style: 'currency',
    currency,
    maximumFractionDigits: 0,
  }).format(amount)
}

type Props = {
  book: PriceBook
  model: PricingModel
  locale: string
  categorySlug: string
  labels: {
    sectionTitle: string
    platformHint: string
    totalLabel: string
    payButton: string
  }
}

export function TierForm({ book, model, locale, categorySlug, labels }: Props) {
  const router = useRouter()
  const [tiers, setTiers] = useState<string[]>([])
  const [platforms, setPlatforms] = useState<string[]>([])

  // 등급 목록은 단가표(book)에서 뽑는다 — model.tiers 는 카테고리 표의 자리표시자일 뿐,
  // 실제로 무엇을 고를 수 있는지는 DB 에 등록된 단가가 결정한다
  const tierOptions = useMemo(() => Object.values(book.entries), [book])
  const total = useMemo(() => previewTotal(book, model, tiers, platforms), [book, model, tiers, platforms])

  const canPay = tiers.length > 0

  function goToPayment() {
    if (!canPay) return
    const query = buildPaymentQuery(tiers, platforms)
    router.push(`/${locale}/order/${categorySlug}/payment?${query}`)
  }

  return (
    <div>
      <section>
        <h2 style={{ fontSize: 'var(--fs-h2)' }}>{labels.sectionTitle}</h2>

        <div className="table-scroll">
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                <th style={{ textAlign: 'left', padding: '8px 12px', borderBottom: '1px solid var(--line-strong)' }} />
                <th style={{ textAlign: 'left', padding: '8px 12px', borderBottom: '1px solid var(--line-strong)' }}>
                  등급
                </th>
                <th style={{ textAlign: 'right', padding: '8px 12px', borderBottom: '1px solid var(--line-strong)' }}>
                  단가
                </th>
              </tr>
            </thead>
            <tbody>
              {tierOptions.map((entry) => (
                <tr key={entry.key} style={{ borderBottom: '1px solid var(--line)' }}>
                  <td style={{ padding: '8px 12px' }}>
                    <input
                      type="checkbox"
                      checked={tiers.includes(entry.key)}
                      onChange={() => setTiers((prev) => toggleValue(prev, entry.key))}
                      aria-label={entry.label}
                    />
                  </td>
                  <td style={{ padding: '8px 12px' }}>{entry.label}</td>
                  <td style={{ padding: '8px 12px', textAlign: 'right' }}>
                    {formatAmount(entry.amount, book.currency)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section style={{ marginTop: 32 }}>
        <h3 style={{ fontSize: 'var(--fs-h3)' }}>플랫폼</h3>
        {/* 플랫폼 선택은 금액에 영향이 없다 — 옆에 그대로 안내한다 (G3) */}
        <p style={{ color: 'var(--ink-500)', fontSize: 'var(--fs-caption)' }}>{labels.platformHint}</p>
        <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
          {PLATFORMS.map((p) => (
            <label key={p} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <input
                type="checkbox"
                checked={platforms.includes(p)}
                onChange={() => setPlatforms((prev) => toggleValue(prev, p))}
              />
              {p}
            </label>
          ))}
        </div>
      </section>

      <section style={{ marginTop: 32 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
          <span>{labels.totalLabel}</span>
          <strong style={{ fontSize: 'var(--fs-h1)' }}>{formatAmount(total, book.currency)}</strong>
        </div>
        <button
          type="button"
          disabled={!canPay}
          onClick={goToPayment}
          style={{ marginTop: 16, width: '100%', padding: '14px 0' }}
        >
          {labels.payButton}
        </button>
      </section>
    </div>
  )
}
