export type OrderScope = 'AY' | 'QT' | 'INQ'

const SCOPES: readonly string[] = ['AY', 'QT', 'INQ']
const PATTERN = /^(AY|QT|INQ)-(\d{8})-(\d{4,})$/

/**
 * 한국 시간 기준의 YYYYMMDD.
 * 서버가 UTC로 돌아도 주문번호의 날짜는 한국 날짜여야 한다.
 */
export function dayKey(date: Date): string {
  const kst = new Date(date.getTime() + 9 * 60 * 60 * 1000)
  const y = kst.getUTCFullYear()
  const m = String(kst.getUTCMonth() + 1).padStart(2, '0')
  const d = String(kst.getUTCDate()).padStart(2, '0')
  return `${y}${m}${d}`
}

export function formatOrderNumber(scope: OrderScope, date: Date, seq: number): string {
  if (!Number.isInteger(seq) || seq < 1) throw new Error(`순번은 1 이상의 정수여야 합니다: ${seq}`)
  return `${scope}-${dayKey(date)}-${String(seq).padStart(4, '0')}`
}

export function parseOrderNumber(value: string): { scope: OrderScope; day: string; seq: number } | null {
  const m = PATTERN.exec(value)
  if (!m) return null
  // PATTERN이 매치됐다면 세 캡처 그룹은 항상 존재한다 (정규식 자체가 필수로 요구한다)
  const scope = m[1] as string
  const day = m[2] as string
  const seq = m[3] as string
  if (!SCOPES.includes(scope)) return null
  return { scope: scope as OrderScope, day, seq: Number(seq) }
}
