import { defineRouting } from 'next-intl/routing'

/**
 * 지원 로케일의 유일한 선언 지점.
 * 여기에만 적어 두면 프록시·레이아웃·언어 전환 버튼이 같은 목록을 본다.
 */
export const routing = defineRouting({
  locales: ['ko', 'ja'],
  defaultLocale: 'ko',
})

export type Locale = (typeof routing.locales)[number]
