import type { CategoryForm } from './category-groups'

/**
 * 결제 화면의 "선택 내용 수정하기"로 돌아왔을 때 폼에 되살릴 선택(2026-09-12 사용자 요청).
 * 결제 화면이 같은 쿼리를 그대로 실어 보내므로, 여기서는 URL 값을 **폼에 있는 항목만** 남기고 되살린다.
 * 금액은 들어 있지 않다 — 되살린 선택으로 결제하면 서버가 DB 단가로 다시 계산한다.
 */
export type RestoreSelection = {
  items: string[]
  pairs: string[]
  tiers: string[]
  platforms: string[]
  period?: string
  size?: string
}

const asList = (v: string | string[] | undefined): string[] => (Array.isArray(v) ? v : typeof v === 'string' ? [v] : [])

export function restoreFromQuery(sp: Record<string, string | string[] | undefined>): RestoreSelection {
  return {
    items: asList(sp.item),
    pairs: asList(sp.pair),
    tiers: asList(sp.tier),
    platforms: asList(sp.platform),
    period: typeof sp.period === 'string' ? sp.period : undefined,
    size: typeof sp.size === 'string' ? sp.size : undefined,
  }
}

/** 묶음 폼(3·4번 등): 항목 키를 그 항목이 속한 묶음으로 나눈다. 단일 묶음은 첫 값만, 혼자만 고르는 항목은 혼자 남긴다 */
export function selectionsFromItems(form: CategoryForm, items: readonly string[]): Record<string, string[]> {
  const out: Record<string, string[]> = {}
  for (const key of new Set(items)) {
    const group = form.groups.find((g) => g.items.some((i) => i.key === key))
    if (!group) continue
    const current = out[group.key] ?? []
    const item = group.items.find((i) => i.key === key)!
    if (!group.multi) {
      if (current.length === 0) out[group.key] = [key]
      continue
    }
    const exclusive = new Set(group.items.filter((i) => i.exclusive).map((i) => i.key))
    if (current.some((k) => exclusive.has(k))) continue
    out[group.key] = item.exclusive ? [key] : [...current, key]
  }
  return out
}

/** 되살린 항목 중 나라가 정해진 첫 항목의 나라 — 한 나라만 보여 줄 때 그 탭을 연다 */
export function tabFromItems(form: CategoryForm, items: readonly string[]): 'kr' | 'jp' | null {
  for (const key of items) {
    for (const g of form.groups) {
      const it = g.items.find((i) => i.key === key)
      if (it?.country) return it.country
    }
  }
  return null
}

/** 2번 영상 쌍: "종류:길이" 중 폼에 있는 종류·길이만, 같은 종류는 처음 것만 */
export function pairsFromQuery(form: CategoryForm, pairs: readonly string[]): { type: string; length: string }[] {
  const types = new Set(form.groups.find((g) => g.key === 'videoType')?.items.map((i) => i.key) ?? [])
  const lengths = new Set(form.groups.find((g) => g.key === 'videoLength')?.items.map((i) => i.key) ?? [])
  const out: { type: string; length: string }[] = []
  for (const raw of pairs) {
    const [type, length, extra] = raw.split(':')
    if (extra !== undefined || !type || !length || !types.has(type) || !lengths.has(length)) continue
    if (out.some((p) => p.type === type)) continue
    out.push({ type, length })
  }
  return out
}
