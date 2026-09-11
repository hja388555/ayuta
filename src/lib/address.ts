/**
 * 주소 검색 공통 규칙. 서버(프록시 route)와 클라이언트(AddressSearch)가 같이 쓴다.
 */
export type AddressPick = { postalCode: string; address1: string }

export type JpAddress = { postalCode: string; prefecture: string; city: string; town: string; address: string }

/** "123-4567" · "1234567" · "１２３－４５６７"(전각) 을 받아 7자리 숫자로. 아니면 null */
export function normalizeJpZip(input: string): string | null {
  const half = input
    .trim()
    .replace(/[０-９]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0xfee0))
    .replace(/[－ー‐]/g, '-')
  const m = /^(\d{3})-?(\d{4})$/.exec(half)
  return m ? `${m[1] ?? ''}${m[2] ?? ''}` : null
}

export const formatJpZip = (zip7: string) => `${zip7.slice(0, 3)}-${zip7.slice(3)}`

type ZipcloudRow = { zipcode?: unknown; address1?: unknown; address2?: unknown; address3?: unknown }

/** zipcloud 응답 → 화면용 카드. 모양이 이상한 행은 버린다 */
export function mapZipcloud(json: unknown): JpAddress[] {
  const rows = (json as { results?: unknown } | null)?.results
  if (!Array.isArray(rows)) return []
  const out: JpAddress[] = []
  for (const r of rows as ZipcloudRow[]) {
    const zip = typeof r?.zipcode === 'string' ? normalizeJpZip(r.zipcode) : null
    const text = (v: unknown) => (typeof v === 'string' ? v.trim() : '')
    const [prefecture, city, town] = [text(r?.address1), text(r?.address2), text(r?.address3)]
    if (!zip || !prefecture) continue
    out.push({ postalCode: formatJpZip(zip), prefecture, city, town, address: `${prefecture}${city}${town}` })
  }
  return out
}
