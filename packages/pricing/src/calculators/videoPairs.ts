import { minor, type PriceBook, type QuoteLine, type QuoteResult } from '../types/index'

export type VideoPair = { type: string; length: string }
export type VideoPairsSelection = { pairs: VideoPair[] }

const reject = (message: string): QuoteResult => ({ ok: false, errors: [{ field: 'pairs', message }] })

/**
 * 2번(현지 영상 제작) — 고른 영상 종류마다 길이를 하나씩 붙여 (종류 + 길이) 쌍을 더한다.
 *
 * sum 과 달리 같은 길이를 두 번 골라도 두 번 센다 — 영상이 두 편이면 길이 값도 두 번 든다.
 * 대신 같은 종류를 두 번 보내는 건 막는다. 화면은 종류마다 한 칸만 주므로, 같은 종류가 두 번
 * 오면 화면을 거치지 않은 요청이고 그대로 받으면 금액이 부풀려진다.
 */
export function calculateVideoPairs(
  book: PriceBook,
  keys: { types: readonly string[]; lengths: readonly string[] },
  sel: VideoPairsSelection,
): QuoteResult {
  if (sel.pairs.length === 0) return reject('영상 종류를 선택해 주세요.')
  // 종류 개수를 넘는 쌍은 종류 중복 없이는 나올 수 없다 — 아래 중복 검사 전에 싸게 막는다
  if (sel.pairs.length > keys.types.length) return reject('선택한 영상이 너무 많습니다.')

  const types = new Set(keys.types)
  const lengths = new Set(keys.lengths)
  const seen = new Set<string>()
  const lines: QuoteLine[] = []

  for (const { type, length } of sel.pairs) {
    if (!length) return reject('고르신 영상마다 길이를 선택해 주세요.')
    if (seen.has(type)) return reject(`같은 영상 종류가 두 번 선택됐습니다: ${type}`)
    seen.add(type)
    // 모르는 키를 조용히 빼고 계산하면 고객이 고른 것과 다른 금액이 청구된다
    const t = types.has(type) ? book.entries[type] : undefined
    const l = lengths.has(length) ? book.entries[length] : undefined
    if (!t || !l) return reject(`단가가 없는 항목입니다: ${type}:${length}`)
    lines.push({ key: `${t.key}:${l.key}`, label: `${t.label} · ${l.label}`, amount: minor(t.amount + l.amount) })
  }

  const total = minor(lines.reduce((acc, line) => acc + line.amount, 0))
  return { ok: true, lines, total, currency: book.currency }
}
