// 카테고리별 동의 항목 정의. 순수 함수 — DB도 화면도 모른다.
// 실제 운용 값(문구·개수)은 contract-templates 컬렉션의 consents 필드가 정본이다.
// 여기는 그 컬렉션이 없는 상태(순수 테스트, 폴백)에서도 화면이 동작하도록 같은 값을 든다 —
// createOrder(Task 4)는 이 함수가 아니라 실제로 읽어온 템플릿의 consents 를 써야 한다.
export type ConsentDef = { key: string; label: string; required: boolean }

const CONSENTS: Record<number, ConsentDef[]> = {
  // 1·2번은 계약 동의 한 줄
  1: [{ key: 'agree', label: '위 계약 내용을 모두 확인하였으며 이에 동의합니다.', required: true }],
  2: [{ key: 'agree', label: '위 계약 내용을 모두 확인하였으며 이에 동의합니다.', required: true }],
  // 4번은 이용약관 / 개인정보 수집·이용 / 계약내용 세 줄
  4: [
    { key: 'terms', label: '이용약관에 동의합니다.', required: true },
    { key: 'privacy', label: '개인정보 수집·이용에 동의합니다.', required: true },
    { key: 'contract', label: '위 계약 내용을 모두 확인하였으며 이에 동의합니다.', required: true },
  ],
}

/** 카테고리별 동의 항목 정의를 돌려준다. 계약서가 없는 카테고리(3·5)는 빈 배열 — 던지지 않는다 */
export function consentsFor(category: number): ConsentDef[] {
  return CONSENTS[category] ?? []
}

/**
 * 필수 동의가 전부 체크됐는지 본다.
 * `checked` 는 클라이언트가 보낸 임의의 키-불리언 맵일 수 있다 — 정의에 없는 키를
 * 체크해도 통과시키지 않는다. required 항목만 골라 defs 기준으로 판정한다.
 */
export function allRequiredChecked(defs: ConsentDef[], checked: Record<string, boolean>): boolean {
  return defs.filter((d) => d.required).every((d) => checked[d.key] === true)
}
