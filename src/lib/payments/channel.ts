export type Currency = 'KRW' | 'JPY'

/** 한 페이지 안에서는 통화가 하나다. 화면에 두 통화가 동시에 나오지 않는다 */
export function currencyForLocale(locale: string): Currency {
  return locale === 'ja' ? 'JPY' : 'KRW'
}

