'use client'

import { usePathname } from 'next/navigation'
import { isFooterHidden } from '@/lib/footer-visibility'
import { SiteFooter } from './SiteFooter'

type Props = Parameters<typeof SiteFooter>[0] & { locale: string }

/**
 * 결제 화면(주문 결제·견적 결제)에서만 사업자정보 푸터를 숨긴다(2026-09-14 5라운드).
 * 판정 로직은 src/lib/footer-visibility.ts 에 있다(단위 테스트 대상).
 */
export function FooterSlot({ locale, ...footerProps }: Props) {
  const pathname = usePathname() ?? `/${locale}`
  if (isFooterHidden(pathname)) return null
  return <SiteFooter {...footerProps} />
}
