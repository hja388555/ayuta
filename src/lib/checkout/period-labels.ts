import koMessages from '../../../messages/ko.json'
import jaMessages from '../../../messages/ja.json'

/**
 * 4번 기간 줄(주문 내역·저장되는 주문 항목)의 이름 — "광고 기간 2주" / "広告期間 2週間".
 * 폼 화면과 같은 messages(groupForm.groupTitles.period · groupForm.periods)를 쓴다.
 * 계산기(sumMultiplier)는 언어를 몰라서 호출자가 모델에 실어 넘긴다.
 */
export function periodLineLabels(locale: string): Record<string, string> {
  const messages = locale === 'ja' ? jaMessages : koMessages
  const title = messages.groupForm.groupTitles.period
  const periods: Record<string, string> = messages.groupForm.periods
  return Object.fromEntries(Object.entries(periods).map(([key, name]) => [key, `${title} ${name}`]))
}
