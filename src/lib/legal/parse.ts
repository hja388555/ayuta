/**
 * 약관 원문(평문)을 화면용 블록으로 나눈다(Figma [v2] 13-A·13-C·13-D).
 * 원문은 법무 정본이라 한 글자도 버리지 않는다 — 모든 블록이 원래 줄(raw)을 들고 있고,
 * blocksToText(parseLegal(body)) === body 가 항상 성립한다(테스트로 고정).
 *
 * - "제N조 …" 또는 "N. …" 로 시작하는 줄 → 번호 제목
 * - "[제목]" 한 줄 → 안내 상자 제목(바로 다음 문단이 상자 본문)
 * - "|" 로 시작하는 연속된 줄 → 표(구분줄 |---| 은 표 모양으로만 쓰인다)
 * - "※" 로 시작하는 문단 → 주의 문단
 * - 그 밖의 연속된 줄 → 문단(줄바꿈 유지)
 */
export type LegalBlock =
  | { type: 'heading'; num: string; text: string; id: string; raw: string }
  | { type: 'callout'; title: string; raw: string }
  | { type: 'table'; rows: string[][]; raw: string }
  | { type: 'note'; text: string; raw: string }
  | { type: 'paragraph'; text: string; raw: string }
  | { type: 'blank'; raw: string }

// 일본어판 약관은 "第N条"(ja-drafts.ts) — 한국어 "제N조"와 같은 번호 제목으로 본다
const HEADING = /^\s*(?:제\s*(\d+)\s*조|第\s*(\d+)\s*条|(\d+)\.)\s*(.*)$/
const CALLOUT = /^\s*\[([^\]]+)\]\s*$/
const TABLE = /^\s*\|/
const SEPARATOR = /^\s*\|?\s*:?-{2,}:?\s*(\|\s*:?-{2,}:?\s*)*\|?\s*$/

export function splitRow(line: string): string[] {
  return line.trim().replace(/^\|/, '').replace(/\|$/, '').split('|').map((c) => c.trim())
}

export function parseLegal(body: string): LegalBlock[] {
  const lines = body.replace(/\r\n?/g, '\n').split('\n')
  const blocks: LegalBlock[] = []
  let i = 0
  while (i < lines.length) {
    const line = lines[i]!
    if (line.trim() === '') {
      blocks.push({ type: 'blank', raw: line })
      i++
      continue
    }
    const h = HEADING.exec(line)
    if (h) {
      const num = h[1] ?? h[2] ?? h[3]!
      blocks.push({ type: 'heading', num, text: line.trim(), id: `sec-${num}`, raw: line })
      i++
      continue
    }
    const c = CALLOUT.exec(line)
    if (c) {
      blocks.push({ type: 'callout', title: c[1]!.trim(), raw: line })
      i++
      continue
    }
    if (TABLE.test(line)) {
      const start = i
      while (i < lines.length && TABLE.test(lines[i]!)) i++
      const raws = lines.slice(start, i)
      const rows = raws.filter((r) => !SEPARATOR.test(r)).map(splitRow)
      blocks.push({ type: 'table', rows, raw: raws.join('\n') })
      continue
    }
    const start = i
    while (i < lines.length && lines[i]!.trim() !== '' && !HEADING.test(lines[i]!) && !CALLOUT.test(lines[i]!) && !TABLE.test(lines[i]!)) i++
    const raw = lines.slice(start, i).join('\n')
    blocks.push(raw.trimStart().startsWith('※') ? { type: 'note', text: raw, raw } : { type: 'paragraph', text: raw, raw })
  }
  // 같은 번호가 두 번 나오면 앵커가 겹치지 않게 뒤에 순번을 붙인다
  const seen = new Map<string, number>()
  for (const b of blocks) {
    if (b.type !== 'heading') continue
    const n = (seen.get(b.id) ?? 0) + 1
    seen.set(b.id, n)
    if (n > 1) b.id = `${b.id}-${n}`
  }
  return blocks
}

export function blocksToText(blocks: LegalBlock[]): string {
  return blocks.map((b) => b.raw).join('\n')
}

export function headingsOf(blocks: LegalBlock[]) {
  return blocks.filter((b): b is Extract<LegalBlock, { type: 'heading' }> => b.type === 'heading')
}
