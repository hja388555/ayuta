/**
 * 메인 서비스 목록 번호(2026-09-19).
 *
 * 지금까지 번호를 이름에 저장했다("5. 기타"). 관리자가 6번째 서비스를 추가하면 목록 순서가
 * "1,2,3,4,6,7,8,9,5. 기타" 처럼 어긋난다 — 「기타」 이름 안의 5가 위치와 안 맞아도 그대로
 * 남기 때문이다. 운영 DB 는 고치지 않는다(직접 쓰기 금지) — 화면에 낼 때만 저장된 번호를 떼고
 * 목록에 놓인 순서(1..N)로 다시 붙인다. 「기타」는 sortOrder 가 가장 커서 항상 마지막 자리를
 * 받는다(관리자 새 서비스 기본 순서는 new-service.ts 가 「기타」 앞에 놓는다).
 */
const LEADING_NUMBER = /^\s*\d+\s*[.)]\s*/

/** 저장된 이름 앞의 "1. "·"5)" 같은 번호 표기를 뗀다. 번호가 없으면 그대로 돌려준다 */
export function stripLeadingNumber(name: string): string {
  return name.replace(LEADING_NUMBER, '')
}

/** 화면에 놓일 순서 그대로 받아 1부터 다시 번호를 매긴다 */
export function numberByListPosition(names: readonly string[]): string[] {
  return names.map((name, i) => `${i + 1}. ${stripLeadingNumber(name)}`)
}
