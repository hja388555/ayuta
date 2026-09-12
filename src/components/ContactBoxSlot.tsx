'use client'

import type { ReactNode } from 'react'
import { usePathname } from 'next/navigation'

/** 채팅 화면(/[locale]/chat…)에서는 본문 하단 문의 박스를 숨긴다 — 이미 1:1 채팅 안이라 "1:1 채팅 문의" 안내가 겹친다 */
export const isChatPath = (pathname: string) => /^\/(ko|ja)\/chat(\/|$)/.test(pathname)

export function ContactBoxSlot({ children }: { children: ReactNode }) {
  const pathname = usePathname() ?? ''
  return isChatPath(pathname) ? null : <>{children}</>
}
