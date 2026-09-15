'use client'

import { usePathname } from 'next/navigation'
import { isFooterHidden } from '@/lib/footer-visibility'
import { SiteFooter } from './SiteFooter'

type Props = Parameters<typeof SiteFooter>[0] & { locale: string }

/**
 * 사업자정보 푸터는 메인에만 보여준다(2026-09-15 결정).
 * 판정 로직은 src/lib/footer-visibility.ts 에 있다(단위 테스트 대상).
 */
export function FooterSlot({ locale, ...footerProps }: Props) {
  const pathname = usePathname() ?? `/${locale}`
  if (isFooterHidden(pathname)) return null
  return <SiteFooter {...footerProps} />
}
