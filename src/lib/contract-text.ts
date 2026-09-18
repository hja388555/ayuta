/**
 * 계약서 전문을 조항 단위로 나눈다(13-B 팝업에서 "제N조" 줄을 제목으로 강조하려고).
 * 원문은 법적 원본이라 글자를 바꾸지 않는다 — 줄을 묶기만 하고 합치면 원문과 같다.
 *
 * 「선택 상품 내용」 구간은 예외다. 원문이 ──── 문자로 선을 그리고 공백으로 값을 맞추는데,
 * 문자 선은 폭이 좁으면 두 줄로 갈라지고 공백 정렬은 글꼴에 따라 어긋난다. 그래서 그 구간만
 * 라벨·값으로 뜯어 화면이 진짜 테두리와 두 칸으로 그린다 — 저장된 글자는 그대로 두고
 * 보여주는 모양만 바꾼다.
 */
export type ContractItemRow = { label: string; value: string }

/** ──── 로 감싼 「선택 상품 내용」 구간. caption·total 은 원문 글자 그대로다 */
export type ContractItemsBlock = { caption: string; rows: ContractItemRow[]; total: ContractItemRow | null }

export type ContractBlock = { heading: string | null; body: string } | { items: ContractItemsBlock }

const ARTICLE = /^\s*제\s*\d+\s*조(?![가-힣])/
const DIVIDER = /^\s*─{5,}\s*$/

export function isArticleHeading(line: string): boolean {
  return ARTICLE.test(line)
}

/** "라벨 : 값" 한 줄. 값이 비어 있어도(아직 안 정한 칸) 라벨은 보여준다 */
function parseRow(line: string): ContractItemRow | null {
  if (!line.trim()) return null
  const at = line.indexOf(':')
  if (at < 0) return { label: line.trim(), value: '' }
  return { label: line.slice(0, at).trim(), value: line.slice(at + 1).trim() }
}

function parseRows(lines: string[]): ContractItemRow[] {
  return lines.map(parseRow).filter((r): r is ContractItemRow => r !== null)
}

/**
 * 선 4개로 감싼 구간을 찾는다(선 / 제목 / 선 / 항목들 / 선 / 총액 / 선).
 * 선이 4개보다 적으면 그런 구간이 없는 것으로 본다 — 견적 계약서(5번)처럼 원문이
 * 다른 계약서는 손대지 않고 통째로 글로 보여준다.
 */
function findItemsBlock(lines: string[]): { start: number; end: number; items: ContractItemsBlock } | null {
  const bars = lines.flatMap((line, i) => (DIVIDER.test(line) ? [i] : []))
  if (bars.length < 4) return null
  const [a, b, c, d] = bars as [number, number, number, number]
  const caption = lines.slice(a + 1, b).join(' ').trim()
  if (!caption) return null
  return {
    start: a,
    end: d,
    items: { caption, rows: parseRows(lines.slice(b + 1, c)), total: parseRow(lines.slice(c + 1, d).join(' ')) },
  }
}

function splitArticles(lines: string[]): ContractBlock[] {
  const blocks: ContractBlock[] = []
  let cur: { heading: string | null; lines: string[] } = { heading: null, lines: [] }
  const flush = () => {
    if (cur.heading !== null || cur.lines.length > 0) blocks.push({ heading: cur.heading, body: cur.lines.join('\n') })
  }
  for (const line of lines) {
    if (isArticleHeading(line)) {
      flush()
      cur = { heading: line, lines: [] }
    } else {
      cur.lines.push(line)
    }
  }
  flush()
  return blocks
}

export function splitContractBlocks(text: string): ContractBlock[] {
  const lines = text.split('\n')
  const found = findItemsBlock(lines)
  if (!found) return splitArticles(lines)
  return [
    ...splitArticles(lines.slice(0, found.start)),
    { items: found.items },
    ...splitArticles(lines.slice(found.end + 1)),
  ]
}
