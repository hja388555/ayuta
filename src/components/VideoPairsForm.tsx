'use client'

import { useMemo, useState } from 'react'
import { pairsFromQuery, selectionsFromItems, type RestoreSelection } from '../lib/order-restore'
import { useMirrorQuery } from '../lib/order-url'
import { useRouter } from 'next/navigation'
import { calculate, type PriceBook, type PricingModel, type VideoPair } from '@ayuta/pricing'
import type { CategoryForm } from '@/lib/category-groups'
import { ChoiceCard, ChoiceGrid, StepTitle } from './ui'
import { formatAmount, PaySection } from './TierForm'
import { initialSelections, nextSelection } from './GroupForm'
import s from './OrderForms.module.css'

/** 화면에서 고르는 중인 쌍. 종류를 막 골랐으면 길이는 아직 없다 */
export type DraftPair = { type: string; length?: string }

/** 영상 종류를 켜고 끈다. 끄면 그 종류에 붙인 길이도 함께 사라진다. 고른 순서가 "영상 N" 번호다 */
export function toggleVideoType(pairs: readonly DraftPair[], type: string): DraftPair[] {
  return pairs.some((p) => p.type === type) ? pairs.filter((p) => p.type !== type) : [...pairs, { type }]
}

/** 한 종류의 길이를 정한다. 종류마다 길이는 하나뿐이라 다시 고르면 바뀐다 */
export function pickLength(pairs: readonly DraftPair[], type: string, length: string): DraftPair[] {
  return pairs.map((p) => (p.type === type ? { type, length } : p))
}

/** 길이까지 정한 쌍만 */
export function completedPairs(pairs: readonly DraftPair[]): VideoPair[] {
  return pairs.filter((p): p is VideoPair => Boolean(p.length))
}

/** 결제로 넘어갈 수 있는지 — 종류를 하나 이상 고르고, 고른 종류마다 길이가 있어야 한다 */
export function canPayPairs(pairs: readonly DraftPair[]): boolean {
  return pairs.length > 0 && pairs.every((p) => Boolean(p.length))
}

/**
 * 화면에 보여줄 금액. 서버가 청구할 금액과 같은 함수(calculate)로 계산한다.
 * 길이를 아직 안 정한 종류는 빼고 센다 — 고르는 동안에도 금액이 늘어나는 게 보이게.
 */
export function previewPairsTotal(book: PriceBook, model: PricingModel, pairs: readonly DraftPair[]): number {
  const done = completedPairs(pairs)
  if (done.length === 0) return 0
  const r = calculate(model, book, { pairs: done })
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
  purpose?: string,
): string {
  const qs = new URLSearchParams()
  for (const k of countryItems) qs.append('item', k)
  for (const p of pairs) qs.append('pair', `${p.type}:${p.length}`)
  for (const c of country) qs.append('country', c)
  if (purpose) qs.set('purpose', purpose)
  return qs.toString()
}

type Labels = {
  groupTitles: Record<string, string>
  groupHints: Record<string, string>
  itemLabels: Record<string, string>
  /** "영상 {n} · {type}" */
  pairTitle: string
  pairsEmpty: string
  totalLabel: string
  payButton: string
  notice: string
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
  purpose?: string
  restore?: RestoreSelection
  labels: Labels
}

/**
 * 2번(현지 영상 제작) 견적 폼 — Figma [v2] 02 현지 영상(218:2 PC · 218:178 Mobile).
 * 영상 종류는 중복 선택이고, 고른 종류마다 아래 "영상별 완성 길이"에서 길이를 하나씩 정한다.
 * 그룹 하나에 선택 목록 하나인 GroupForm 모양과 맞지 않아 따로 둔다.
 */
export function VideoPairsForm({ form, model, book, locale, categorySlug, country, purpose, restore, labels }: Props) {
  const router = useRouter()
  const countryGroup = form.groups.find((g) => g.key === 'country')
  const typeGroup = form.groups.find((g) => g.key === 'videoType')
  const lengthGroup = form.groups.find((g) => g.key === 'videoLength')

  // 촬영 국가는 표지에서 고른 나라를 미리 체크한다(GroupForm 과 같은 규칙)
  // 결제 화면에서 돌아왔으면 그때 고른 촬영 국가·영상 쌍을 되살린다
  const [countryItems, setCountryItems] = useState<string[]>(() => {
    const restored = selectionsFromItems(form, restore?.items ?? []).country
    return restored && restored.length > 0 ? restored : (initialSelections(form, country).country ?? [])
  })
  const [pairs, setPairs] = useState<DraftPair[]>(() => pairsFromQuery(form, restore?.pairs ?? []))

  const total = useMemo(() => previewPairsTotal(book, model, pairs), [book, model, pairs])
  const canPay = canPayPairs(pairs)

  const label = (key: string): string => book.entries[key]?.label ?? labels.itemLabels[key] ?? key
  const price = (key: string) => {
    const entry = book.entries[key]
    return entry ? <span className={s.price}>{formatAmount(entry.amount, book.currency)}</span> : null
  }

  // 고른 내용을 주소에 옮겨 적는다 — 새로고침·언어 전환 뒤에도 restore 로 되살아난다.
  // 길이를 아직 안 고른 종류는 쿼리 모양(종류:길이)에 담을 수 없어 빠진다
  const query = buildPairsQuery(completedPairs(pairs), countryItems, country, purpose)
  useMirrorQuery(query)

  function goToPayment() {
    if (!canPay) return
    router.push(`/${locale}/order/${categorySlug}/checkout?${query}`)
  }

  const summary = [
    ...countryItems.map(label),
    ...pairs.map((p) => (p.length ? `${label(p.type)} · ${label(p.length)}` : label(p.type))),
  ]

  return (
    <>
      {countryGroup && (
        <section className={`${s.step} ${s.grid}`}>
          <StepTitle n={1} id="group-country" title={labels.groupTitles.country ?? ''} hint={labels.groupHints.country} />
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
          <StepTitle n={2} id="group-videoType" title={labels.groupTitles.videoType ?? ''} hint={labels.groupHints.videoType} />
          <div className={s.rows} role="group" aria-labelledby="group-videoType">
            {typeGroup.items.map((item) => (
              <ChoiceCard
                key={item.key}
                type="checkbox"
                checked={pairs.some((p) => p.type === item.key)}
                onClick={() => setPairs((prev) => toggleVideoType(prev, item.key))}
              >
                <span>{label(item.key)}</span>
                {price(item.key)}
              </ChoiceCard>
            ))}
          </div>
        </section>
      )}

      {lengthGroup && (
        <section className={s.step}>
          <StepTitle n={3} id="group-videoPairs" title={labels.groupTitles.videoPairs ?? ''} hint={labels.groupHints.videoPairs} />
          {pairs.length === 0 ? (
            <p className={s.empty}>{labels.pairsEmpty}</p>
          ) : (
            <div className={s.pairs}>
              {pairs.map((p, i) => {
                const id = `pair-${p.type}`
                return (
                  <div key={p.type} className={s.pairBlock}>
                    <h3 id={id} className={s.pairTitle}>
                      {labels.pairTitle.replace('{n}', String(i + 1)).replace('{type}', label(p.type))}
                    </h3>
                    <div className={s.pairGrid}>
                      <ChoiceGrid cols={lengthGroup.items.length} labelledBy={id}>
                        {lengthGroup.items.map((item) => (
                          <ChoiceCard
                            key={item.key}
                            type="radio"
                            name={id}
                            checked={p.length === item.key}
                            onChange={() => setPairs((prev) => pickLength(prev, p.type, item.key))}
                          >
                            <span>{label(item.key)}</span>
                            {price(item.key)}
                          </ChoiceCard>
                        ))}
                      </ChoiceGrid>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </section>
      )}

      {/* 기본 포함 칩 — 선택지가 아니라 안내다 */}
      <section className={s.step}>
        <StepTitle n={4} title={labels.groupTitles.basicIncluded ?? ''} hint={labels.groupHints.basicIncluded} />
        <ul className={s.chips} style={{ listStyle: 'none', margin: 0, padding: 0 }}>
          {labels.basicIncludedItems.map((c) => (
            <li key={c} className={s.chip}>
              <img src="/ui/check-chip.svg" alt="" width={16} height={16} />
              {c}
            </li>
          ))}
        </ul>
      </section>

      <p className={s.note}>{labels.shortVideoNote}</p>

      <PaySection
        totalLabel={labels.totalLabel}
        sub={summary.length ? summary.join(' · ') : undefined}
        amount={formatAmount(total, book.currency)}
        payButton={labels.payButton}
        notice={labels.notice}
        disabled={!canPay}
        onPay={goToPayment}
      />
    </>
  )
}
