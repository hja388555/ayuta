'use client'

import { useMemo, useState } from 'react'
import { selectionsFromItems, type RestoreSelection } from '../lib/order-restore'
import { useCheckoutGuard, useMirrorQuery } from '../lib/order-url'
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
  purposes: readonly string[] = [],
): string {
  const qs = new URLSearchParams()
  for (const k of allSelectedKeys) qs.append('item', k)
  if (period) qs.set('period', period)
  const trimmed = size?.trim()
  if (trimmed) qs.set('size', trimmed.slice(0, sizeMaxLength))
  // 표지에서 고른 나라·목적을 그대로 실어 보낸다 — 이 화면에서 다시 고르게 하지 않는다
  for (const c of country) qs.append('country', c)
  for (const p of purposes) qs.append('purpose', p)
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

/** 3·4번 첫 체크 상태. 표지에서 고른 나라(한국 → 일본 순), 없으면 둘 다 체크한다 */
export function initialCountries(cover: readonly string[]): CountryTab[] {
  const picked = coverCountries(cover)
  return picked.length > 0 ? picked : ['kr', 'jp']
}

/**
 * 나라 체크박스를 눌렀을 때의 다음 상태. 끄면 그 나라 항목을 선택에서 뺀다.
 * 마지막 남은 나라는 끌 수 없다 — 최소 한 나라는 항상 켜져 있어야 한다
 */
export function toggleCountry(
  countries: readonly CountryTab[],
  c: CountryTab,
  form: CategoryForm,
  selections: Readonly<Record<string, readonly string[]>>,
): { countries: CountryTab[]; selections: Record<string, string[]> } {
  const copy: Record<string, string[]> = {}
  for (const [k, v] of Object.entries(selections)) copy[k] = [...v]
  if (countries.includes(c)) {
    if (countries.length === 1) return { countries: [...countries], selections: copy }
    const drop = new Set(form.groups.flatMap((g) => g.items.filter((i) => i.country === c).map((i) => i.key)))
    const next: Record<string, string[]> = {}
    for (const [k, v] of Object.entries(copy)) next[k] = v.filter((key) => !drop.has(key))
    return { countries: countries.filter((x) => x !== c), selections: next }
  }
  return { countries: (['kr', 'jp'] as const).filter((x) => x === c || countries.includes(x)), selections: copy }
}

/**
 * 되살린 선택 중, 체크된 나라에 없는 항목을 뺀다.
 * URL의 country= 와 item= 은 각자 따로 신뢰할 수 없다 — 손으로 고친 주소가
 * country=kr 만 실어도 item= 에는 일본 항목이 남아 있을 수 있고, 그대로 두면
 * 화면엔 안 보이는데 금액엔 몰래 합산된다(toggleCountry가 나라를 끌 때 지키는 것과 같은 규칙).
 */
export function dropOtherCountries(
  form: CategoryForm,
  selections: Readonly<Record<string, readonly string[]>>,
  countries: readonly CountryTab[],
): Record<string, string[]> {
  if (!form.countryTabs) return { ...selections } as Record<string, string[]>
  const allowed = new Set(
    form.groups.flatMap((g) => g.items.filter((i) => !i.country || countries.includes(i.country)).map((i) => i.key)),
  )
  const out: Record<string, string[]> = {}
  for (const [k, v] of Object.entries(selections)) out[k] = v.filter((key) => allowed.has(key))
  return out
}

/** 묶음의 항목을 고른 나라마다 열로 나눈다. 나라 없는 묶음은 열 하나 */
export function countryColumns(
  group: GroupDef,
  countries: readonly CountryTab[],
): { country: CountryTab | null; items: ItemDef[] }[] {
  if (!group.items.some((i) => i.country)) return [{ country: null, items: group.items }]
  return countries
    .map((c) => ({ country: c, items: group.items.filter((i) => i.country === c) }))
    .filter((col) => col.items.length > 0)
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

// 도시처럼 금액칸 없이 카드로 고르는 그룹(Figma v2: 3열 카드). 나머지는 금액이 붙는 행 목록
const CARD_GROUPS = new Set(['country'])
// 도시 묶음은 priced:true 지만 화면에 금액을 보이지 않는다(계산은 그대로, 표시만 보류 — 클라이언트 확답 대기)
const CITY_GROUPS = new Set(['subwayCity', 'busCity'])

type Labels = {
  groupTitles: Record<string, string>
  groupHints: Record<string, string>
  itemLabels: Record<string, string>
  periods: Record<string, string>
  countries: Record<CountryTab, string>
  sizeLabel: string
  sizePlaceholder: string
  totalLabel: string
  itemsLabel: string
  payButton: string
  /** 2번 기본 포함 칩 — 선택지가 아니라 안내다 */
  basicIncludedItems?: string[]
  shortVideoNote?: string
  /** 항목 이름 아래 한 줄 설명(3번 블로그 소개, 지역 커뮤니티 괄호 문구 등) */
  itemDescriptions?: Record<string, string>
  posterNote?: string
}

type Props = {
  form: CategoryForm
  model: PricingModel
  book: PriceBook
  locale: string
  categorySlug: string
  // 표지에서 이미 고른 나라·목적. 여기서는 그대로 들고만 간다
  country: readonly string[]
  purposes: readonly string[]
  restore?: RestoreSelection
  labels: Labels
}

export function GroupForm({ form, model, book, locale, categorySlug, country, purposes, restore, labels }: Props) {
  const router = useRouter()
  const { pending, goToCheckout } = useCheckoutGuard()
  // 3·4번 한국/일본 체크. 쿼리(표지에서 온 값이 새로고침·언어전환·뒤로가기로 되돌아온 값)를 그대로 첫 상태로 쓴다
  const initialCountriesValue = initialCountries(country)
  const [countries, setCountries] = useState<CountryTab[]>(initialCountriesValue)
  // 표지 1단계의 광고 국가를 그대로 적용한다(2026-09-12 사용자 요청).
  // 결제 화면 "선택 내용 수정하기"로 돌아왔으면 고른 항목·기간·사이즈를 되살린다.
  // URL을 손으로 고쳐 country= 는 한 나라만, item= 은 다른 나라 것까지 들고 온 경우
  // 화면엔 안 보이는 항목이 몰래 합산되면 안 된다 — 첫 상태에서부터 체크된 나라 것만 남긴다(toggleCountry와 같은 규칙)
  const [selections, setSelections] = useState<Record<string, string[]>>(() => {
    const restored = dropOtherCountries(form, selectionsFromItems(form, restore?.items ?? []), initialCountriesValue)
    return Object.keys(restored).length > 0 ? { ...initialSelections(form, country), ...restored } : initialSelections(form, country)
  })
  const [period, setPeriod] = useState<string | undefined>(() => (restore?.period && form.periods?.includes(restore.period) ? restore.period : undefined))
  const [size, setSize] = useState(() => (restore?.size ?? '').slice(0, form.freeText?.[0]?.maxLength ?? 0))

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

  function onToggleCountry(c: CountryTab) {
    const r = toggleCountry(countries, c, form, selections)
    setCountries(r.countries)
    setSelections(r.selections)
  }

  function labelForItem(key: string): string {
    // 금액칸이 있는 항목은 loadPriceBook 이 이미 통화에 맞는 언어로 라벨을 골라 뒀다.
    // 금액이 없는 항목(국가)과 단가가 아직 없는 항목은 messages 쪽 라벨로 보충한다.
    return book.entries[key]?.label ?? labels.itemLabels[key] ?? key
  }

  // 이 화면에서 고른 나라가 country= 로 나간다 — 표지 값 대신 실제 선택을 계약서·주문에 싣는다
  const queryCountries = form.countryTabs ? countries : country
  const query = buildGroupQuery(allSelected, period, size, form.freeText?.[0]?.maxLength ?? 0, queryCountries, purposes)
  useMirrorQuery(query)

  function goToPayment() {
    if (!canPay) return
    goToCheckout(router, `/${locale}/order/${categorySlug}`, query, `/${locale}/order/${categorySlug}/checkout?${query}`)
  }

  function priceText(item: ItemDef, groupKey: string): string | undefined {
    if (!item.priced || CITY_GROUPS.has(groupKey)) return undefined
    const entry = book.entries[item.key]
    return entry ? formatAmount(entry.amount, book.currency) : undefined
  }

  const summary = [...allSelected.map(labelForItem), ...(period ? [labels.periods[period] ?? period] : [])]

  return (
    <>
      {form.countryTabs && (
        <ChoiceGrid cols={2}>
          {(['kr', 'jp'] as const).map((c) => (
            <ChoiceCard key={c} type="checkbox" checked={countries.includes(c)} onChange={() => onToggleCountry(c)}>
              {labels.countries[c]}
            </ChoiceCard>
          ))}
        </ChoiceGrid>
      )}

      {form.groups.map((group) => {
        const id = `group-${group.key}`
        const chosen = selections[group.key] ?? []

        // 3·4번(한국/일본 체크)만 나라 열 레이아웃을 쓴다 — 2번은 기존 레이아웃 그대로
        if (form.countryTabs) {
          const cols = countryColumns(group, countries)
          if (cols.length === 0) return null
          const card = (item: ItemDef) => {
            const desc = labels.itemDescriptions?.[item.key]
            const price = priceText(item, group.key)
            const sub = desc || price ? (
              <>
                {desc ? <span className={s.desc}>{desc}</span> : null}
                {price ? <span className={s.price}>{price}</span> : null}
              </>
            ) : undefined
            return (
              <ChoiceCard
                key={item.key}
                type={group.multi ? 'checkbox' : 'radio'}
                name={group.multi ? undefined : id}
                checked={chosen.includes(item.key)}
                onClick={() => pick(group, item.key)}
                sub={sub}
              >
                {labelForItem(item.key)}
              </ChoiceCard>
            )
          }
          // 두 열의 항목 수가 같으면(3번 전국·지역신문·커뮤니티, 4번 도시) 한 줄에 나라별로 번갈아 넣어
          // ChoiceGrid 의 같은-줄 높이 맞춤을 그대로 쓴다. 수가 다르면 열을 나눠 각자 세로로 쌓는다
          const sameLength = cols.length > 1 && cols.every((col) => col.items.length === cols[0]!.items.length)
          const interleaved = sameLength
            ? cols[0]!.items.flatMap((_, i) => cols.map((col) => col.items[i]!))
            : null
          return (
            <section key={group.key} className={s.step}>
              <StepTitle id={id} title={labels.groupTitles[group.key] ?? group.key} hint={labels.groupHints[group.key]} />
              {interleaved ? (
                <ChoiceGrid cols={cols.length} labelledBy={id}>
                  {interleaved.map(card)}
                </ChoiceGrid>
              ) : cols.length > 1 ? (
                <div className={s.countryCols} role="group" aria-labelledby={id}>
                  {cols.map((col) => (
                    <div key={col.country} className={s.countryCol}>
                      {col.items.map(card)}
                    </div>
                  ))}
                </div>
              ) : (
                <div className={group.key === 'blog' ? s.oneCol : undefined}>
                  <ChoiceGrid cols={2} labelledBy={id}>
                    {cols[0]!.items.map(card)}
                  </ChoiceGrid>
                </div>
              )}
              {group.key === 'posterBillboard' && labels.posterNote ? <p className={s.posterNote}>{labels.posterNote}</p> : null}
            </section>
          )
        }

        const cards = CARD_GROUPS.has(group.key)
        return (
          <section key={group.key} className={`${s.step} ${cards ? s.grid : ''}`}>
            <StepTitle id={id} title={labels.groupTitles[group.key] ?? group.key} hint={labels.groupHints[group.key]} />
            {cards ? (
              <ChoiceGrid cols={group.key === 'country' ? 2 : 3} labelledBy={id}>
                {group.items.map((item) => (
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
                {group.items.map((item) => {
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

      {form.freeText && (
        <section className={`${s.step} ${s.grid}`}>
          <StepTitle id="group-size" title={labels.groupTitles.sizePeriod ?? labels.sizeLabel} />
          {form.freeText.map((t) => (
            <div key={t.key} className={s.field}>
              <label htmlFor={`free-${t.key}`} className={s.srOnly}>{labels.sizeLabel}</label>
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
        </section>
      )}

      {form.periods && (
        <section className={`${s.step} ${s.grid} ${s.periods}`}>
          <StepTitle id="group-period" title={labels.groupTitles.period ?? ''} />
          <ChoiceGrid cols={form.periods.length} labelledBy="group-period">
            {form.periods.map((p) => (
              <ChoiceCard key={p} type="radio" name="period" checked={period === p} onChange={() => setPeriod(p)}>
                {labels.periods[p] ?? p}
              </ChoiceCard>
            ))}
          </ChoiceGrid>
        </section>
      )}

      {labels.basicIncludedItems && (
        <section className={s.step}>
          <StepTitle
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
