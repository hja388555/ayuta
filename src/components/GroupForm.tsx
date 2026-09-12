'use client'

import { useMemo, useState } from 'react'
import { selectionsFromItems, tabFromItems, type RestoreSelection } from '../lib/order-restore'
import { useMirrorQuery } from '../lib/order-url'
import { useRouter } from 'next/navigation'
import { calculate, type PriceBook, type PricingModel } from '@ayuta/pricing'
import type { CategoryForm, GroupDef, ItemDef } from '@/lib/category-groups'
import { ChoiceCard, ChoiceGrid, StepTitle } from './ui'
import { formatAmount, PaySection } from './TierForm'
import s from './OrderForms.module.css'

/**
 * 화면의 묶음 선택(그룹키 → 고른 항목 키 목록)에서, 실제로 금액칸을 가진 항목만 뽑는다.
 * country 처럼 priced:false 인 항목은 계산기에 보내면 "단가 없음"으로
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
 * 금액이 없는 선택(국가)도 주문 메모로 쓰이므로 함께 담는다.
 * 사이즈 자유 입력은 원문을 그대로 화면에 되돌려 그리지 않고, 길이 상한을 넘기면 자른다.
 */
export function buildGroupQuery(
  allSelectedKeys: readonly string[],
  period: string | undefined,
  size: string | undefined,
  sizeMaxLength: number,
  country: readonly string[] = [],
  purpose?: string,
): string {
  const qs = new URLSearchParams()
  for (const k of allSelectedKeys) qs.append('item', k)
  if (period) qs.set('period', period)
  const trimmed = size?.trim()
  if (trimmed) qs.set('size', trimmed.slice(0, sizeMaxLength))
  // 표지에서 고른 나라·목적을 그대로 실어 보낸다 — 이 화면에서 다시 고르게 하지 않는다
  for (const c of country) qs.append('country', c)
  if (purpose) qs.set('purpose', purpose)
  return qs.toString()
}

export type CountryTab = 'kr' | 'jp'

/**
 * 항목을 눌렀을 때의 다음 선택. 단일 그룹은 하나만, 중복 그룹은 켜고 끈다.
 * exclusive 항목(예: "포스터 제작 안함")은 혼자만 남고, 다른 항목을 고르면 빠진다.
 */
export function nextSelection(group: GroupDef, current: readonly string[], key: string): string[] {
  if (!group.multi) return current.includes(key) ? [] : [key]
  if (current.includes(key)) return current.filter((k) => k !== key)
  if (group.items.find((i) => i.key === key)?.exclusive) return [key]
  const exclusive = new Set(group.items.filter((i) => i.exclusive).map((i) => i.key))
  return [...current.filter((k) => !exclusive.has(k)), key]
}

/** 표지에서 고른 광고 국가(kr·jp)만, 한국 → 일본 순서로 */
export function coverCountries(country: readonly string[]): CountryTab[] {
  return (['kr', 'jp'] as const).filter((c) => country.includes(c))
}

/** 화면에 둘 나라 탭. 표지에서 한 나라만 골랐으면 그 탭만, 둘 다 골랐거나 안 골랐으면 두 탭 */
export function countryTabsFor(country: readonly string[]): CountryTab[] {
  const picked = coverCountries(country)
  return picked.length === 1 ? picked : ['kr', 'jp']
}

/** 첫 선택 상태. 2번의 "촬영 국가" 묶음은 표지에서 고른 나라를 미리 체크해 둔다 */
export function initialSelections(form: CategoryForm, country: readonly string[]): Record<string, string[]> {
  const picked = coverCountries(country)
  const out: Record<string, string[]> = {}
  const group = form.groups.find((g) => g.key === 'country')
  if (group && picked.length > 0) {
    out[group.key] = group.items.map((i) => i.key).filter((k) => picked.some((c) => k === `country-${c}`))
  }
  return out
}

/** 한국/일본 탭에 보일 항목만 남긴다. country 가 없는 항목(위치·포스터 등)은 두 탭 모두에 보인다 */
export function visibleItems(group: GroupDef, tab: CountryTab | null): ItemDef[] {
  if (!tab) return group.items
  return group.items.filter((i) => !i.country || i.country === tab)
}

// 도시처럼 금액칸 없이 카드로 고르는 그룹(Figma v2: 3열 카드). 나머지는 금액이 붙는 행 목록
const CARD_GROUPS = new Set(['country', 'subwayCity', 'busCity'])

type Labels = {
  groupTitles: Record<string, string>
  groupHints: Record<string, string>
  itemLabels: Record<string, string>
  periods: Record<string, string>
  countryTabs: Record<CountryTab, string>
  sizeLabel: string
  sizePlaceholder: string
  totalLabel: string
  payButton: string
  notice: string
  /** 2번 기본 포함 칩 — 선택지가 아니라 안내다 */
  basicIncludedItems?: string[]
  shortVideoNote?: string
}

type Props = {
  form: CategoryForm
  model: PricingModel
  book: PriceBook
  locale: string
  categorySlug: string
  // 표지에서 이미 고른 나라·목적. 여기서는 그대로 들고만 간다
  country: readonly string[]
  purpose?: string
  restore?: RestoreSelection
  labels: Labels
}

export function GroupForm({ form, model, book, locale, categorySlug, country, purpose, restore, labels }: Props) {
  const router = useRouter()
  // 표지 1단계의 광고 국가를 그대로 적용한다(2026-09-12 사용자 요청).
  // 결제 화면 "선택 내용 수정하기"로 돌아왔으면 고른 항목·기간·사이즈를 되살린다
  const [selections, setSelections] = useState<Record<string, string[]>>(() => {
    const restored = selectionsFromItems(form, restore?.items ?? [])
    return Object.keys(restored).length > 0 ? { ...initialSelections(form, country), ...restored } : initialSelections(form, country)
  })
  const [period, setPeriod] = useState<string | undefined>(() => (restore?.period && form.periods?.includes(restore.period) ? restore.period : undefined))
  const [size, setSize] = useState(() => (restore?.size ?? '').slice(0, form.freeText?.[0]?.maxLength ?? 0))
  // 첫 탭은 표지에서 고른 나라를 따른다. 없으면 화면 언어로 정한다
  const tabs = countryTabsFor(country)
  // 한국·일본을 둘 다 골랐으면 탭을 오가도 고른 것을 유지한다 — 두 나라 항목을 함께 주문할 수 있다
  const keepAcrossTabs = coverCountries(country).length === 2
  const [tab, setTab] = useState<CountryTab>(() => {
    if (tabs.length === 1) return tabs[0]!
    // 되살린 항목이 한 나라 것이면 그 탭을 연다(두 나라 모두 고른 경우엔 탭을 오가도 유지된다)
    const restoredTab = tabFromItems(form, restore?.items ?? [])
    return restoredTab ?? coverCountries(country)[0] ?? (locale === 'ja' ? 'jp' : 'kr')
  })
  const activeTab = form.countryTabs ? tab : null

  const priced = useMemo(() => pricedKeys(form, selections), [form, selections])
  const total = useMemo(() => previewGroupTotal(book, model, priced, period), [book, model, priced, period])

  const allSelected = useMemo(() => Object.values(selections).flat(), [selections])
  const canPay = allSelected.length > 0 && (!form.periods || Boolean(period))

  function pick(group: GroupDef, key: string) {
    setSelections((prev) => {
      const current = prev[group.key] ?? []
      const next = nextSelection(group, current, key)
      return { ...prev, [group.key]: next }
    })
  }

  // 탭을 바꾸면 고른 것을 비운다 — 안 보이는 다른 나라 항목이 몰래 합산되면 안 된다.
  // 단, 표지에서 두 나라를 모두 골랐으면 둘 다 주문하려는 것이라 유지한다(아래 요약에 전부 보인다)
  function switchTab(next: CountryTab) {
    if (next === tab) return
    setTab(next)
    if (!keepAcrossTabs) setSelections(initialSelections(form, country))
  }

  function labelForItem(key: string): string {
    // 금액칸이 있는 항목은 loadPriceBook 이 이미 통화에 맞는 언어로 라벨을 골라 뒀다.
    // 금액이 없는 항목(국가)과 단가가 아직 없는 항목은 messages 쪽 라벨로 보충한다.
    return book.entries[key]?.label ?? labels.itemLabels[key] ?? key
  }

  // 고른 내용을 주소에 옮겨 적는다 — 새로고침·언어 전환 뒤에도 restore 로 되살아난다
  const query = buildGroupQuery(allSelected, period, size, form.freeText?.[0]?.maxLength ?? 0, country, purpose)
  useMirrorQuery(query)

  function goToPayment() {
    if (!canPay) return
    router.push(`/${locale}/order/${categorySlug}/checkout?${query}`)
  }

  const groups = form.groups
    .map((g) => ({ group: g, items: visibleItems(g, activeTab) }))
    .filter((g) => g.items.length > 0)

  const summary = [
    ...(activeTab && !keepAcrossTabs ? [labels.countryTabs[activeTab]] : []),
    ...allSelected.map(labelForItem),
    ...(period ? [labels.periods[period] ?? period] : []),
  ]

  let n = 0
  return (
    <>
      {form.countryTabs && (
        <div className={s.tabs} role="tablist">
          {tabs.map((c) => (
            <button
              key={c}
              type="button"
              role="tab"
              aria-selected={tab === c}
              className={s.tab}
              onClick={() => switchTab(c)}
            >
              {labels.countryTabs[c]}
            </button>
          ))}
        </div>
      )}

      {groups.map(({ group, items }) => {
        n += 1
        const id = `group-${group.key}`
        const chosen = selections[group.key] ?? []
        const cards = CARD_GROUPS.has(group.key)
        return (
          <section key={group.key} className={`${s.step} ${cards ? s.grid : ''}`}>
            <StepTitle
              n={n}
              id={id}
              title={labels.groupTitles[group.key] ?? group.key}
              hint={labels.groupHints[group.key]}
            />
            {cards ? (
              <ChoiceGrid cols={group.key === 'country' ? 2 : 3} labelledBy={id}>
                {items.map((item) => (
                  <ChoiceCard
                    key={item.key}
                    type={group.multi ? 'checkbox' : 'radio'}
                    name={group.multi ? undefined : id}
                    checked={chosen.includes(item.key)}
                    onClick={() => pick(group, item.key)}
                  >
                    {labelForItem(item.key)}
                  </ChoiceCard>
                ))}
              </ChoiceGrid>
            ) : (
              <div className={s.rows} role="group" aria-labelledby={id}>
                {items.map((item) => {
                  const entry = book.entries[item.key]
                  return (
                    <ChoiceCard
                      key={item.key}
                      type={group.multi ? 'checkbox' : 'radio'}
                      name={group.multi ? undefined : id}
                      checked={chosen.includes(item.key)}
                      onClick={() => pick(group, item.key)}
                    >
                      <span>{labelForItem(item.key)}</span>
                      {item.priced && entry && <span className={s.price}>{formatAmount(entry.amount, book.currency)}</span>}
                    </ChoiceCard>
                  )
                })}
              </div>
            )}
          </section>
        )
      })}

      {(form.periods || form.freeText) && (
        <section className={`${s.step} ${s.grid}`}>
          <StepTitle n={++n} id="group-period" title={labels.groupTitles.sizePeriod ?? labels.groupTitles.period ?? ''} />
          {form.freeText?.map((t) => (
            <div key={t.key} className={s.field}>
              <label htmlFor={`free-${t.key}`}>{labels.sizeLabel}</label>
              <input
                id={`free-${t.key}`}
                type="text"
                value={size}
                maxLength={t.maxLength}
                placeholder={labels.sizePlaceholder}
                onChange={(e) => setSize(e.target.value)}
              />
            </div>
          ))}
          {form.periods && (
            <ChoiceGrid cols={form.periods.length} labelledBy="group-period">
              {form.periods.map((p) => (
                <ChoiceCard key={p} type="radio" name="period" checked={period === p} onChange={() => setPeriod(p)}>
                  {labels.periods[p] ?? p}
                </ChoiceCard>
              ))}
            </ChoiceGrid>
          )}
        </section>
      )}

      {labels.basicIncludedItems && (
        <section className={s.step}>
          <StepTitle
            n={++n}
            title={labels.groupTitles.basicIncluded ?? ''}
            hint={labels.groupHints.basicIncluded}
          />
          <ul className={s.chips} style={{ listStyle: 'none', margin: 0, padding: 0 }}>
            {labels.basicIncludedItems.map((c) => (
              <li key={c} className={s.chip}>
                <img src="/ui/check-chip.svg" alt="" width={16} height={16} />
                {c}
              </li>
            ))}
          </ul>
        </section>
      )}

      {labels.shortVideoNote && <p className={s.note}>{labels.shortVideoNote}</p>}

      <PaySection
        totalLabel={labels.totalLabel}
        sub={allSelected.length ? summary.join(' · ') : undefined}
        amount={formatAmount(total, book.currency)}
        payButton={labels.payButton}
        notice={labels.notice}
        disabled={!canPay}
        onPay={goToPayment}
      />
    </>
  )
}
