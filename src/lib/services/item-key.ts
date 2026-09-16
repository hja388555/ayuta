/**
 * 항목 키를 서버가 만든다(2026-09-16).
 *
 * 키는 만든 뒤 바뀌지 않는다 — 단가·주문 스냅샷·계약서 항목이 모두 이 이름으로 서로를 찾는다.
 * 관리자가 직접 입력하면 오타 하나로 조용히 다른 항목을 가리키므로, 규칙으로 만들어 준다.
 *
 * 모양: s<서비스번호>-<묶음키>-<순번>. 지워진 번호는 다시 쓰지 않는다(옛 주문과 새 항목이
 * 같은 이름을 갖는 것을 막는다).
 */
const MAX_GROUP_PART = 20

function groupPart(groupKey: string): string {
  const cleaned = groupKey
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, MAX_GROUP_PART)
    .replace(/-+$/, '')
  // 한글만 쓴 묶음 키처럼 남는 글자가 없을 때가 있다
  return cleaned || 'g'
}

export function nextItemKey(serviceNo: number, groupKey: string, existing: string[]): string {
  const prefix = `s${serviceNo}-${groupPart(groupKey)}-`
  let max = 0
  for (const key of existing) {
    if (!key.startsWith(prefix)) continue
    const n = Number(key.slice(prefix.length))
    if (Number.isInteger(n) && n > max) max = n
  }
  return `${prefix}${max + 1}`
}
