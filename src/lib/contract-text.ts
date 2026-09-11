/**
 * 계약서 전문을 조항 단위로 나눈다(13-B 팝업에서 "제N조" 줄을 제목으로 강조하려고).
 * 원문은 법적 원본이라 글자를 바꾸지 않는다 — 줄을 묶기만 하고 합치면 원문과 같다.
 */
export type ContractBlock = { heading: string | null; body: string }

const ARTICLE = /^\s*제\s*\d+\s*조(?![가-힣])/

export function isArticleHeading(line: string): boolean {
  return ARTICLE.test(line)
}

export function splitContractBlocks(text: string): ContractBlock[] {
  const blocks: ContractBlock[] = []
  let cur: { heading: string | null; lines: string[] } = { heading: null, lines: [] }
  const flush = () => {
    if (cur.heading !== null || cur.lines.length > 0) blocks.push({ heading: cur.heading, body: cur.lines.join('\n') })
  }
  for (const line of text.split('\n')) {
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
