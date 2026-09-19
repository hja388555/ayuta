/**
 * 새 광고 서비스의 번호와 주소를 서버가 정한다(2026-09-16).
 *
 * 번호(no)와 주소(slug)는 만든 뒤 못 바꾼다 — 주문·계약서·단가가 번호로 서로를 찾고,
 * 주소는 고객이 이미 공유한 링크다. 그래서 관리자가 입력하지 않고 여기서 만든다.
 *
 * 번호는 기존 최대값 + 1. 지워진 번호는 다시 쓰지 않는다(옛 주문이 새 서비스를 가리키게 된다).
 */
const RESERVED_SLUGS = new Set(['order', 'quote', 'manage', 'api', 'chat', 'mypage', 'terms', 'privacy', 'refund'])

export function nextServiceNo(existing: number[]): number {
  return existing.reduce((max, n) => (Number.isInteger(n) && n > max ? n : max), 0) + 1
}

export type SortableService = { sortOrder: number; model: string }

/**
 * 새 서비스의 기본 순서(2026-09-19).
 *
 * 「기타」는 이름이 아니라 계산 방식(model: 'inquiry')으로 찾는다 — 이름은 관리자가 언제든
 * 고칠 수 있어 못 믿는다. 「기타」 뒤에 새 서비스를 붙이면 메인 목록 마지막 자리를 「기타」한테서
 * 뺏는다(문제의 원인). 그래서 기존 서비스 중 「기타」가 아닌 것들의 순서 다음, 「기타」 앞자리를
 * 기본값으로 준다 — 관리자가 폼에서 숫자를 그대로 두면 항상 이 자리에 들어간다.
 */
export function defaultSortOrderForNew(existing: SortableService[]): number {
  const others = existing.filter((s) => s.model !== 'inquiry')
  const maxOthers = others.reduce((max, s) => Math.max(max, s.sortOrder), 0)
  const inquiry = existing.filter((s) => s.model === 'inquiry')
  if (inquiry.length === 0) return maxOthers + 10

  const minInquiry = inquiry.reduce((min, s) => Math.min(min, s.sortOrder), Infinity)
  const mid = Math.floor((maxOthers + minInquiry) / 2)
  return mid > maxOthers ? mid : maxOthers + 1
}

/**
 * 이름에서 주소를 만든다. 한국어 이름이 대부분이라 남는 글자가 없을 때가 많아,
 * 그때는 번호를 그대로 쓴다(service-6 처럼 뜻 없는 이름보다 짧고 고치기 쉽다).
 */
export function serviceSlug(nameKo: string, no: number, taken: string[]): string {
  const cleaned = nameKo
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40)
    .replace(/-+$/, '')

  // 한국어 이름에서 영문이 다 떨어져 나가고 숫자만 남는 일이 흔하다("6. 옥외 광고 2026" → "6-2026").
  // 뜻 없는 숫자 주소를 고객 링크로 내보내지 않는다
  const base = /[a-z]/.test(cleaned) ? cleaned : `service-${no}`

  const used = new Set(taken)
  const safe = RESERVED_SLUGS.has(base) ? `${base}-${no}` : base
  if (!used.has(safe)) return safe

  // 이름이 겹치면 뒤에 번호를 붙인다. 그것도 겹치면(이미 지운 뒤 다시 만든 경우) 하나씩 올린다
  let candidate = `${safe}-${no}`
  let suffix = no
  while (used.has(candidate)) {
    suffix += 1
    candidate = `${safe}-${suffix}`
  }
  return candidate
}
