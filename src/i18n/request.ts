import { getRequestConfig } from 'next-intl/server'
import { hasLocale } from 'next-intl'
import { routing } from './routing'

export default getRequestConfig(async ({ requestLocale }) => {
  const requested = await requestLocale
  // URL 은 누구나 임의의 값을 넣을 수 있다. 목록에 없는 로케일로
  // 메시지 파일을 불러오려다 500 을 내는 대신 기본 로케일로 떨어뜨린다.
  const locale = hasLocale(routing.locales, requested) ? requested : routing.defaultLocale

  return {
    locale,
    messages: (await import(`../../messages/${locale}.json`)).default,
  }
})
