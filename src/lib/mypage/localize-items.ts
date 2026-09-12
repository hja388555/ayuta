import type { PriceBook } from '@ayuta/pricing'
import { COUNTRY_ITEM_LABEL, PLATFORM_LABELS, TIER_ITEM_LABELS } from '../checkout/contract-items'
import { COUNTRY_CODES, formatCountries } from '../cover-selection'
import koMessages from '../../../messages/ko.json'
import jaMessages from '../../../messages/ja.json'

type Locale = 'ko' | 'ja'
export type DisplayItem = { label: string; value: string }

/**
 * 주문 상세 "주문 내용" 줄을 보는 사람 언어로 바꾼다(화면 표시 전용).
 *
 * contractItems 는 주문 당시 언어로 굳힌 스냅샷이고, 1번(tier) 라벨 "등급"/"플랫폼"은 로케일과 무관하게
 * 한국어로 저장된다(create-order.ts 가 그 라벨로 값을 찾는다). 스냅샷은 계약서 원문과 짝이라 고치지 않고,
 * 보여 줄 때만 원문 → 번역 사전으로 바꾼다. 사전에 없는 말(관리자가 그 뒤 고친 단가 이름 등)은 원문 그대로 둔다.
 */
export function localizeContractItems(items: DisplayItem[], dict: ReadonlyMap<string, string>): DisplayItem[] {
  const word = (w: string) => dict.get(w) ?? w
  // 값은 "A, B" 목록이거나 영상 한 줄 "종류 · 길이" 모양이다 — 조각마다 바꾼다
  const value = (v: string) => (dict.has(v) ? word(v) : v.split(', ').map((part) => part.split(' · ').map(word).join(' · ')).join(', '))
  return items.map((it) => ({ label: word(it.label), value: value(it.value) }))
}

const messagesFor = (locale: Locale) => (locale === 'ja' ? jaMessages : koMessages)

/** 주문 언어(from)의 표기 → 보는 언어(to)의 표기 사전. 단가 이름은 두 통화의 단가표를 key 로 짝짓는다 */
export function contractItemDictionary(from: Locale, to: Locale, books: { from?: PriceBook; to?: PriceBook } = {}): Map<string, string> {
  const dict = new Map<string, string>()
  const add = (a: string | undefined, b: string | undefined) => {
    if (a && b && !dict.has(a)) dict.set(a, b)
  }
  const f = messagesFor(from).groupForm
  const t = messagesFor(to).groupForm
  const pairRecord = (a: Record<string, string>, b: Record<string, string>) => Object.keys(a).forEach((k) => add(a[k], b[k]))

  // 저장 시 로케일과 상관없이 한국어로 박히는 1번 라벨
  add(TIER_ITEM_LABELS.tier, messagesFor(to).mypage.detail.tier)
  add(TIER_ITEM_LABELS.platform, messagesFor(to).mypage.detail.platform)
  for (const p of Object.values(PLATFORM_LABELS)) add(p[from], p[to])
  add(COUNTRY_ITEM_LABEL[from], COUNTRY_ITEM_LABEL[to])
  for (const c of COUNTRY_CODES) add(formatCountries([c], from), formatCountries([c], to))

  if (books.from && books.to) {
    for (const [key, entry] of Object.entries(books.from.entries)) add(entry.label, books.to.entries[key]?.label)
  }
  pairRecord(f.groupTitles, t.groupTitles)
  pairRecord(f.itemLabels, t.itemLabels)
  pairRecord(f.periods, t.periods)
  add(f.sizeLabel, t.sizeLabel)
  for (let n = 1; n <= 20; n++) add(f.pairContractLabel.replace('{n}', String(n)), t.pairContractLabel.replace('{n}', String(n)))
  return dict
}
