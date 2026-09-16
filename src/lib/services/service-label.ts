/**
 * 주문 화면·마이페이지·계약서 목록이 서비스 이름을 그리는 방법(2026-09-16).
 *
 * 지금까지는 번호로 상수를 찾아 번역 키(services.<slug>)로 이름을 냈다. 관리자가 만든 6번 이후
 * 서비스는 그 번역 키가 없어 이름이 비거나 키가 그대로 보인다. DB 이름을 먼저 쓰고, 없을 때만
 * 기존 번역으로 돌아간다 — 1~5번은 지금까지 보이던 문구가 그대로 유지된다.
 *
 * 이름 앞에 번호를 붙일지는 이름이 이미 번호로 시작하는지로 정한다. 관리자가 "6. 옥외 광고"라고
 * 적어 둔 이름에 번호를 또 붙이면 "6. 6. 옥외 광고"가 된다.
 */
export type ServiceName = { nameKo: string; nameJa: string }

export function serviceLabel(
  no: number,
  locale: string,
  fromDb: ServiceName | undefined,
  fallback: string | undefined,
): string {
  const name = fromDb ? (locale === 'ja' ? fromDb.nameJa : fromDb.nameKo).trim() : ''
  if (name) return /^\s*\d+\s*[.·]/.test(name) ? name : `${no}. ${name}`
  return fallback ? `${no}. ${fallback}` : '-'
}
