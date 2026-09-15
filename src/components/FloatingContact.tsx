'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { isFloatingVisible } from '@/lib/floating-visibility'

type ContactLabels = { home: string; call: string; chat: string; mypage: string }

const icon = (name: string, color?: string) => (
  <span className="icon-mask" style={{ color, ['--icon-url' as string]: `url(/ui/tab-${name}-fill.svg)` }} aria-hidden />
)

/**
 * PC(≥768px) 전용 오른쪽 세로 메뉴 — 전화 · 1:1 채팅 · 마이페이지(2026-09-16 홈 제거).
 * 모바일은 하단 탭바가 같은 기능을 맡아 globals.css 의 `.round-contact` 로 숨긴다.
 */
export function FloatingContact({ locale, phone, labels }: { locale: string; phone: string; labels: ContactLabels }) {
  const pathname = usePathname()
  const home = `/${locale}`
  if (!isFloatingVisible(pathname)) return null
  return (
    <nav className="round-contact round-contact-fixed" aria-label="Menu">
      <a href={`tel:${phone.replace(/[^\d+]/g, '')}`} className="round-contact-btn" aria-label={labels.call}>
        {icon('phone', '#16a34a')}
      </a>
      <Link href={`${home}/chat`} className="round-contact-btn" aria-label={labels.chat}>
        <span className="round-contact-chat-text">{labels.chat}</span>
      </Link>
      <Link href={`${home}/mypage`} className="round-contact-btn" aria-label={labels.mypage}>
        {icon('user', 'var(--c-title)')}
      </Link>
    </nav>
  )
}
