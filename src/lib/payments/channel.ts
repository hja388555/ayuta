export type Currency = 'KRW' | 'JPY'
export type ChannelEnv = { krw?: string; jpy?: string }

/** 한 페이지 안에서는 통화가 하나다. 화면에 두 통화가 동시에 나오지 않는다 */
export function currencyForLocale(locale: string): Currency {
  return locale === 'ja' ? 'JPY' : 'KRW'
}

/**
 * 통화에 맞는 포트원 채널키.
 * 크로스보더 PG 계약이 끝나지 않은 채로 배포되면 결제창을 띄우기 전에 여기서 실패해야 한다.
 * 잘못된 채널로 결제창이 뜨면 고객 돈이 엉뚱한 통화로 빠진다.
 */
export function channelKeyFor(currency: Currency, env: ChannelEnv): string {
  const key = currency === 'KRW' ? env.krw : env.jpy
  if (!key) throw new Error(`${currency} 결제 채널이 설정되지 않았습니다.`)
  return key
}
