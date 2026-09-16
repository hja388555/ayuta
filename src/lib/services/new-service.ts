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
