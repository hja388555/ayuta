// 화면 표시 전용 줄바꿈 보정. 저장 문구(계약서·contractItems 등)는 절대 건드리지 않는다 —
// 이 함수는 렌더 시점에만 호출한다.

/**
 * 라벨의 마지막 단어가 한 글자면 바로 앞 단어와 줄바꿈 없는 공백(NBSP)으로 묶는다.
 * "역내 포스터 제작 함" → "역내 포스터 제작 함" — 좁은 화면에서 "제작 / 함"처럼
 * 한 글자만 다음 줄로 떨어지는 것을 막는다. 원본 문자열(계약서 등)은 그대로 두고
 * 이 함수를 통과한 결과만 화면에 그린다.
 */
export function keepTrailingWordTogether(label: string): string {
  const lastSpace = label.lastIndexOf(' ')
  if (lastSpace === -1) return label
  const tail = label.slice(lastSpace + 1)
  if (tail.length !== 1) return label
  return `${label.slice(0, lastSpace)} ${tail}`
}
