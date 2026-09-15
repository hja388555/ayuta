'use client'

import { useMemo, useState } from 'react'
import { pairsFromQuery, selectionsFromItems, type RestoreSelection } from '../lib/order-restore'
import { useCheckoutGuard, useMirrorQuery } from '../lib/order-url'
import { useRouter } from 'next/navigation'
import { calculate, type PriceBook, type PricingModel, type VideoPair } from '@ayuta/pricing'
import type { CategoryForm } from '@/lib/category-groups'
import { ChoiceCard, ChoiceGrid, StepTitle } from './ui'
import { formatAmount, PaySection, toggleValue } from './TierForm'
import { initialSelections, nextSelection } from './GroupForm'
import s from './OrderForms.module.css'

/** 고른 종류마다 같은 길이를 붙여 쌍을 만든다. 길이를 아직 안 골랐으면 쌍이 없다 */
export function pairsForSingleLength(types: readonly string[], length: string | undefined): VideoPair[] {
  return length ? types.map((type) => ({ type, length })) : []
}

/** 결제 화면에서 돌아왔을 때 되살릴 값 — 종류 목록과 (모든 쌍이 같은 길이이므로) 첫 쌍의 길이 */
export function singleLengthFromPairs(pairs: readonly { type: string; length: string }[]): { types: string[]; length?: string } {
  return { types: pairs.map((p) => p.type), length: pairs[0]?.length }
}

/**
 * 화면에 보여줄 금액. 서버가 청구할 금액과 같은 함수(calculate)로 계산한다.
 */
export function previewPairsTotal(book: PriceBook, model: PricingModel, pairs: readonly VideoPair[]): number {
  if (pairs.length === 0) return 0
  const r = calculate(model, book, { pairs: [...pairs] })
  return r.ok ? r.total : 0
}

/**
 * 결제 화면으로 넘길 쿼리스트링. 금액은 담지 않는다 — 서버가 DB 단가로 다시 계산한다.
 * 촬영 국가(금액 없음)는 item=, 쌍은 pair=종류:길이 로 담는다(selection-from-query.ts 와 짝).
 */
export function buildPairsQuery(
  pairs: readonly VideoPair[],
  countryItems: readonly string[],
  country: readonly string[] = [],
  purposes: readonly string[] = [],
): string {
  const qs = new URLSearchParams()
  for (const k of countryItems) qs.append('item', k)
  for (const p of pairs) qs.append('pair', `${p.type}:${p.length}`)
  for (const c of country) qs.append('country', c)
  for (const p of purposes) qs.append('purpose', p)
  return qs.toString()
}

type Labels = {
  groupTitles: Record<string, string>
  groupHints: Record<string, string>
  itemLabels: Record<string, string>
  totalLabel: string
  itemsLabel: string
  payButton: string
  basicIncludedItems: string[]
  shortVideoNote: string
}

type Props = {
  form: CategoryForm
  model: PricingModel
  book: PriceBook
  locale: string
  categorySlug: string
  country: readonly string[]
  purposes: readonly string[]
  restore?: RestoreSelection
  labels: Labels
}

/**
 * 2번(현지 영상 제작) 견적 폼 — Figma [v3] 02 현지 영상(303:188 Mobile · 303:60 PC).
 * 영상 종류는 중복 선택이지만, 완성 영상 길이는 전체 종류에 한 번만 고른다.
 * 그룹 하나에 선택 목록 하나인 GroupForm 모양과 맞지 않아 따로 둔다.
 */
export function VideoPairsForm({ form, model, book, locale, categorySlug, country, purposes, restore, labels }: Props) {
  const router = useRouter()
  const { pending, goToCheckout } = useCheckoutGuard()
  const countryGroup = form.groups.find((g) => g.key === 'country')
  const typeGroup = form.groups.find((g) => g.key === 'videoType')
  const lengthGroup = form.groups.find((g) => g.key === 'videoLength')

  // 촬영 국가는 표지에서 고른 나라를 미리 체크한다(GroupForm 과 같은 규칙)
  // 결제 화면에서 돌아왔으면 그때 고른 촬영 국가·영상 종류·길이를 되살린다
  const [countryItems, setCountryItems] = useState<string[]>(() => {
    const restored = selectionsFromItems(form, restore?.items ?? []).country
    return restored && restored.length > 0 ? restored : (initialSelections(form, country).country ?? [])
  })
  const restoredSingle = useMemo(() => singleLengthFromPairs(pairsFromQuery(form, restore?.pairs ?? [])), [form, restore])
  const [types, setTypes] = useState<string[]>(() => restoredSingle.types)
  const [length, setLength] = useState<string | undefined>(() => restoredSingle.length)

  const pairs = useMemo(() => pairsForSingleLength(types, length), [types, length])
  const total = useMemo(() => previewPairsTotal(book, model, pairs), [book, model, pairs])
  const canPay = types.length > 0 && Boolean(length)

  const label = (key: string): string => book.entries[key]?.label ?? labels.itemLabels[key] ?? key
  const priceText = (key: string): string | undefined =>
    book.entries[key] ? formatAmount(book.entries[key].amount, book.currency) : undefined

  // 고른 내용을 주소에 옮겨 적는다 — 새로고침·언어 전환 뒤에도 restore 로 되살아난다.
  const query = buildPairsQuery(pairs, countryItems, country, purposes)
  useMirrorQuery(query)

  function goToPayment() {
    if (!canPay) return
    goToCheckout(router, `/${locale}/order/${categorySlug}`, query, `/${locale}/order/${categorySlug}/checkout?${query}`)
  }

  const summary = [...countryItems.map(label), ...types.map(label), ...(length ? [label(length)] : [])]

  return (
    <>
      {countryGroup && (
        <section className={`${s.step} ${s.grid}`}>
          <StepTitle id="group-country" title={labels.groupTitles.country ?? ''} />
          <ChoiceGrid cols={2} labelledBy="group-country">
            {countryGroup.items.map((item) => (
              <ChoiceCard
                key={item.key}
                type="checkbox"
                checked={countryItems.includes(item.key)}
                onClick={() => setCountryItems((prev) => nextSelection(countryGroup, prev, item.key))}
              >
                {label(item.key)}
              </ChoiceCard>
            ))}
          </ChoiceGrid>
        </section>
      )}

      {typeGroup && (
        <section className={s.step}>
          <StepTitle id="group-videoType" title={labels.groupTitles.videoType ?? ''} />
          <ChoiceGrid cols={2} labelledBy="group-videoType">
            {typeGroup.items.map((item) => (
              <ChoiceCard
                key={item.key}
                type="checkbox"
                checked={types.includes(item.key)}
                sub={priceText(item.key) ? <span className={s.price}>{priceText(item.key)}</span> : undefined}
                onChange={() => setTypes((prev) => toggleValue(prev, item.key))}
              >
                {label(item.key)}
              </ChoiceCard>
            ))}
          </ChoiceGrid>
        </section>
      )}

      {lengthGroup && (
        <section className={s.step} data-group="videoLength">
          <StepTitle id="group-videoLength" title={labels.groupTitles.videoLength ?? ''} />
          <ChoiceGrid cols={2} labelledBy="group-videoLength">
            {lengthGroup.items.map((item) => (
              <ChoiceCard
                key={item.key}
                type="radio"
                name="videoLength"
                checked={length === item.key}
                sub={priceText(item.key) ? <span className={s.price}>{priceText(item.key)}</span> : undefined}
                onChange={() => setLength(item.key)}
              >
                {label(item.key)}
              </ChoiceCard>
            ))}
          </ChoiceGrid>
        </section>
      )}

      {/* 기본 포함 칩 — 선택지가 아니라 안내다 */}
      <section className={s.step}>
        <StepTitle title={labels.groupTitles.basicIncluded ?? ''} />
        <ul className={s.chips2}>
          {labels.basicIncludedItems.map((c, i) => (
            <li key={`${i}-${c}`} className={s.chip2}>
              <span className="icon-mask" style={{ width: 16, height: 16, ['--icon-url' as string]: "url('/ui/check-chip.svg')" }} aria-hidden />
              {c}
            </li>
          ))}
        </ul>
      </section>

      <p className={s.videoNote}>{labels.shortVideoNote}</p>

      <PaySection
        totalLabel={labels.totalLabel}
        itemsLabel={labels.itemsLabel}
        items={summary}
        amount={formatAmount(total, book.currency)}
        payButton={labels.payButton}
        disabled={!canPay || pending}
        onPay={goToPayment}
      />
    </>
  )
}
