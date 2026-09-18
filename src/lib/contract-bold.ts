/**
 * 계약서 조항 본문의 `**강조**` 표시만 굵게 그리기 위한 파서(13-B 팝업 articleBody).
 * 저장된 글자는 그대로 두고 렌더링만 바꾼다는 contract-text.ts 와 같은 원칙 —
 * 이 파일은 문자열을 자르지 않고, 화면이 어디를 <strong>으로 감쌀지 구간만 알려준다.
 *
 * `**`가 짝을 이루지 못하면(원문에 별표만 남거나 닫는 짝이 없으면) 강조로 보지 않고
 * 별표까지 포함해 그대로 보여준다 — 깨진 파싱보다 못생긴 원문이 낫다.
 */
export type BoldSegment = { bold: boolean; text: string }

const BOLD = /\*\*(.+?)\*\*/gs

export function parseBoldSegments(text: string): BoldSegment[] {
  const segments: BoldSegment[] = []
  let last = 0
  for (const match of text.matchAll(BOLD)) {
    const start = match.index ?? 0
    if (start > last) segments.push({ bold: false, text: text.slice(last, start) })
    segments.push({ bold: true, text: match[1] ?? '' })
    last = start + match[0].length
  }
  if (last < text.length) segments.push({ bold: false, text: text.slice(last) })
  return segments
}
