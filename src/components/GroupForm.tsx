'use client'

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { calculate, type PriceBook, type PricingModel } from '@ayuta/pricing'
import type { CategoryForm, GroupDef } from '@/lib/category-groups'
import { toggleValue } from './TierForm'

/**
 * 화면의 묶음 선택(그룹키 → 고른 항목 키 목록)에서, 실제로 금액칸을 가진 항목만 뽑는다.
 * country · posterBillboard 처럼 priced:false 인 항목은 계산기에 보내면 "단가 없음"으로
 * 통째로 거부된다 — 계산에 들어갈 항목과 주문 메모에만 실릴 항목을 여기서 갈라야 한다.
 */
export function pricedKeys(form: CategoryForm, selections: Readonly<Record<string, readonly string[]>>): string[] {
  const result: string[] = []
  for (const group of form.groups) {
    const chosen = selections[group.key] ?? []
    for (const key of chosen) {
      const item = group.items.find((i) => i.key === key)
      if (item?.priced) result.push(key)
    }
  }
  return result
}

/**
 * 화면에 보여줄 금액. 서버가 청구할 금액과 **같은 함수**로 계산한다.
 * 계산이 실패하면(선택 없음, 단가 없는 키, 기간 미선택) 0을 보여준다 —
 * 틀린 금액을 보여주는 것보다 낫다.
 */
export function previewGroupTotal(
  book: PriceBook,
  model: PricingModel,
  items: readonly string[],
  period?: string,
): number {
  const sel: Record<string, unknown> = { items: [...items] }
  if (model.kind === 'sumMultiplier') sel.period = period ?? ''
  const r = calculate(model, book, sel)
  return r.ok ? r.total : 0
}

/**
 * 결제 화면으로 넘길 쿼리스트링을 만든다.
 * 금액은 절대 포함하지 않는다 — 서버가 DB 단가로 다시 계산한 값만 청구한다.
 * 금액이 없는 선택(국가, 별도문의 플래그)도 주문 메모로 쓰이므로 함께 담는다.
 * 사이즈 자유 입력은 원문을 그대로 화면에 되돌려 그리지 않고, 길이 상한을 넘기면 자른다.
 */
export function buildGroupQuery(
  allSelectedKeys: readonly string[],
  period: string | undefined,
  size: string | undefined,
  sizeMaxLength: number,
): string {
  const qs = new URLSearchParams()
  for (const k of allSelectedKeys) qs.append('item', k)
  if (period) qs.set('period', period)
  const trimmed = size?.trim()
  if (trimmed) qs.set('size', trimmed.slice(0, sizeMaxLength))
  return qs.toString()
}

function formatAmount(amount: number, currency: PriceBook['currency']): string {
  return new Intl.NumberFormat(currency === 'KRW' ? 'ko-KR' : 'ja-JP', {
    style: 'currency',
    currency,
    maximumFractionDigits: 0,
  }).format(amount)
}

// 포스터·전광판 제작(4번)처럼 priced 항목이 하나도 없는 그룹은 가격표가 아니라
// 별도문의 안내다 — 체크박스로 그리면 "이건 공짜구나"로 읽힌다 (Correction D)
function isInquiryOnlyGroup(group: GroupDef): boolean {
  return group.items.length > 0 && group.items.every((i) => !i.priced)
}

type Labels = {
  groupTitles: Record<string, string>
  itemLabels: Record<string, string>
  periods: Record<string, string>
  sizeLabel: string
  sizePlaceholder: string
  totalLabel: string
  payButton: string
  inquiryBadge: string
  basicIncludedNote?: string
}

type Props = {
  form: CategoryForm
  model: PricingModel
  book: PriceBook
  locale: string
  categorySlug: string
  labels: Labels
}

export function GroupForm({ form, model, book, locale, categorySlug, labels }: Props) {
  const router = useRouter()
  const [selections, setSelections] = useState<Record<string, string[]>>({})
  const [period, setPeriod] = useState<string | undefined>(undefined)
  const [size, setSize] = useState('')

  const priced = useMemo(() => pricedKeys(form, selections), [form, selections])
  const total = useMemo(() => previewGroupTotal(book, model, priced, period), [book, model, priced, period])

  const allSelected = useMemo(() => Object.values(selections).flat(), [selections])
  const canPay = allSelected.length > 0 && (!form.periods || Boolean(period))

  function pick(group: GroupDef, key: string) {
    setSelections((prev) => {
      const current = prev[group.key] ?? []
      const next = group.multi ? toggleValue(current, key) : current.includes(key) ? [] : [key]
      return { ...prev, [group.key]: next }
    })
  }

  function labelForItem(key: string): string {
    // 금액칸이 있는 항목은 loadPriceBook 이 이미 통화에 맞는 언어로 라벨을 골라 뒀다.
    // 금액이 없는 항목(국가, 별도문의)은 단가표에 없으므로 messages 쪽 라벨로 보충한다.
    return book.entries[key]?.label ?? labels.itemLabels[key] ?? key
  }

  function goToPayment() {
    if (!canPay) return
    const query = buildGroupQuery(allSelected, period, size, form.freeText?.[0]?.maxLength ?? 0)
    router.push(`/${locale}/order/${categorySlug}/checkout?${query}`)
  }

  return (
    <div>
      {form.groups.map((group) => (
        <section key={group.key} style={{ marginTop: 32 }}>
          <h3 style={{ fontSize: 'var(--fs-h3)' }}>{labels.groupTitles[group.key] ?? group.key}</h3>

          {isInquiryOnlyGroup(group) ? (
            // 별도문의 그룹 — 가격이 보이는 체크박스 목록이 아니라 별개의 안내 박스로 그린다
            <div style={{ border: '1px dashed var(--line-strong)', padding: '12px 16px', borderRadius: 8 }}>
              <span style={{ fontWeight: 600 }}>{labels.inquiryBadge}</span>
              <div style={{ display: 'flex', gap: 16, marginTop: 8, flexWrap: 'wrap' }}>
                {group.items.map((item) => (
                  <label key={item.key} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <input
                      type="radio"
                      name={`group-${group.key}`}
                      checked={(selections[group.key] ?? []).includes(item.key)}
                      onChange={() => pick(group, item.key)}
                    />
                    {labelForItem(item.key)}
                  </label>
                ))}
              </div>
            </div>
          ) : (
            <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
              {group.items.map((item) => (
                <label key={item.key} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <input
                    type={group.multi ? 'checkbox' : 'radio'}
                    name={group.multi ? undefined : `group-${group.key}`}
                    checked={(selections[group.key] ?? []).includes(item.key)}
                    onChange={() => pick(group, item.key)}
                  />
                  {labelForItem(item.key)}
                  {item.priced && book.entries[item.key] && (
                    <span style={{ color: 'var(--ink-500)', fontSize: 'var(--fs-caption)' }}>
                      ({formatAmount(book.entries[item.key]!.amount, book.currency)})
                    </span>
                  )}
                </label>
              ))}
            </div>
          )}
        </section>
      ))}

      {form.periods && (
        <section style={{ marginTop: 32 }}>
          <h3 style={{ fontSize: 'var(--fs-h3)' }}>{labels.groupTitles.period ?? '기간'}</h3>
          <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
            {form.periods.map((p) => (
              <label key={p} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <input
                  type="radio"
                  name="period"
                  checked={period === p}
                  onChange={() => setPeriod(p)}
                />
                {labels.periods[p] ?? p}
              </label>
            ))}
          </div>
        </section>
      )}

      {form.freeText?.map((t) => (
        <section key={t.key} style={{ marginTop: 32 }}>
          <h3 style={{ fontSize: 'var(--fs-h3)' }}>{labels.sizeLabel}</h3>
          <input
            type="text"
            value={size}
            maxLength={t.maxLength}
            placeholder={labels.sizePlaceholder}
            onChange={(e) => setSize(e.target.value)}
            style={{ width: '100%', padding: '10px 12px' }}
          />
        </section>
      ))}

      {labels.basicIncludedNote && (
        <p style={{ marginTop: 24, color: 'var(--ink-500)', fontSize: 'var(--fs-sm)' }}>{labels.basicIncludedNote}</p>
      )}

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
