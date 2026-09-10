import type { PriceBook } from '@ayuta/pricing'
import type { CategoryDef } from '../categories'
import { formFor } from '../category-groups'
import koMessages from '../../../messages/ko.json'
import jaMessages from '../../../messages/ja.json'

export type ContractItem = { label: string; value: string }

// 플랫폼(채널)은 금액에 관여하지 않아 price-entries 에 없다 — 계약서에는 그래도 "무엇을
// 골랐는지"가 남아야 하므로 고정 표기를 둔다. messages/*.json 에는 이 라벨이 없다
// (TierForm 은 화면에 원문 키를 그대로 찍는다) — 계약서는 고객이 서명하는 문서라 사람이
// 읽을 이름으로 바꿔 넣는다.
const PLATFORM_LABELS: Record<string, { ko: string; ja: string }> = {
  instagram: { ko: '인스타그램', ja: 'Instagram' },
  youtube: { ko: '유튜브', ja: 'YouTube' },
  tiktok: { ko: '틱톡', ja: 'TikTok' },
  line: { ko: 'LINE', ja: 'LINE' },
}

type Messages = typeof koMessages

const messagesFor = (locale: 'ko' | 'ja'): Messages => (locale === 'ja' ? (jaMessages as Messages) : koMessages)

const asStringArray = (v: unknown): string[] => (Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : [])

/**
 * 계약서 {{items}} 자리에 펼칠 "무엇을 샀는지" 목록을 만든다.
 *
 * quote.lines 는 금액칸이 있는 항목만 담고(그래서 국가·채널 같은 선택이 통째로 빠진다),
 * 값도 금액이다 — 계약서에 "국가: ₩1,200,000" 처럼 찍히면 안 된다. 그래서 여기는 quote가
 * 아니라 원본 선택(rawSelection, priced/unpriced 가리지 않은 전체)을 category-groups.ts
 * 정의를 따라 다시 훑어 사람이 읽을 라벨로 바꾼다. 금액은 절대 여기 섞지 않는다 —
 * 금액은 계약서의 총 계약금액/계약금액 줄({{amount}})에만 나온다.
 */
export function buildContractItems(def: CategoryDef, book: PriceBook, rawSelection: unknown, locale: 'ko' | 'ja'): ContractItem[] {
  const messages = messagesFor(locale)
  const groupTitles: Record<string, string> = messages.groupForm.groupTitles
  const itemLabels: Record<string, string> = messages.groupForm.itemLabels
  const periods: Record<string, string> = messages.groupForm.periods

  const labelForKey = (key: string): string => book.entries[key]?.label ?? itemLabels[key] ?? key

  if (def.model.kind === 'tier') {
    const sel = typeof rawSelection === 'object' && rawSelection !== null ? (rawSelection as { tiers?: unknown; platforms?: unknown }) : {}
    const tiers = asStringArray(sel.tiers)
    const platforms = asStringArray(sel.platforms)
    const items: ContractItem[] = []
    if (tiers.length > 0) items.push({ label: '등급', value: tiers.map(labelForKey).join(', ') })
    if (platforms.length > 0) {
      items.push({ label: '플랫폼', value: platforms.map((p) => PLATFORM_LABELS[p]?.[locale] ?? p).join(', ') })
    }
    return items
  }

  if (def.model.kind !== 'sum' && def.model.kind !== 'sumMultiplier') return []

  const form = formFor(def.model.category)
  if (!form) return []

  const sel = typeof rawSelection === 'object' && rawSelection !== null ? (rawSelection as { items?: unknown; period?: unknown; size?: unknown }) : {}
  const chosenKeys = new Set(asStringArray(sel.items))

  const items: ContractItem[] = []
  for (const group of form.groups) {
    const selected = group.items.filter((i) => chosenKeys.has(i.key))
    if (selected.length === 0) continue
    items.push({ label: groupTitles[group.key] ?? group.key, value: selected.map((i) => labelForKey(i.key)).join(', ') })
  }

  if (def.model.kind === 'sumMultiplier' && typeof sel.period === 'string' && sel.period) {
    items.push({ label: groupTitles.period ?? '기간', value: periods[sel.period] ?? sel.period })
  }

  const size = typeof sel.size === 'string' ? sel.size.trim() : ''
  if (size) items.push({ label: messages.groupForm.sizeLabel, value: size })

  return items
}
