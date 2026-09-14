'use client'

import type { ReactNode } from 'react'
import { usePathname } from 'next/navigation'

/** 채팅(이미 1:1 채팅 안)과 주문 화면(1~5번·결제, 2026-09-12 클라이언트 요청)에서는 본문 하단 문의 박스를 숨긴다 */
export const hideContactBox = (pathname: string) => /^\/(ko|ja)\/(chat|order)(\/|$)/.test(pathname)

export function ContactBoxSlot({ children }: { children: ReactNode }) {
  const pathname = usePathname() ?? ''
  return hideContactBox(pathname) ? null : <>{children}</>
}
