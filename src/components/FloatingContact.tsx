'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useState } from 'react'
import { isFloatingVisible } from '@/lib/floating-visibility'

type ContactLabels = { home: string; call: string; chat: string; mypage: string }

const icon = (name: string, color?: string) => (
  <span className="icon-mask" style={{ color, ['--icon-url' as string]: `url(/ui/tab-${name}-fill.svg)` }} aria-hidden />
)

/**
 * PC(≥768px) 전용 오른쪽 세로 메뉴 — 전화 · 1:1 채팅 · 마이페이지(2026-09-16 홈 제거).
 * 모바일은 하단 탭바가 같은 기능을 맡아 globals.css 의 `.round-contact` 로 숨긴다.
 * PC 에는 거는 장치가 없는 경우가 많아 tel: 로 보내지 않고 번호를 펼쳐 보여 준다.
 */
export function FloatingContact({ locale, phone, labels }: { locale: string; phone: string; labels: ContactLabels }) {
  const pathname = usePathname()
  const [phoneOpen, setPhoneOpen] = useState(false)
  const home = `/${locale}`
  if (!isFloatingVisible(pathname)) return null
  return (
    <nav className="round-contact round-contact-fixed" aria-label="Menu">
      <div className="round-contact-phone">
        {phoneOpen ? <span className="round-contact-number">{phone}</span> : null}
        <button
          type="button"
          className="round-contact-btn"
          aria-label={labels.call}
          aria-expanded={phoneOpen}
          onClick={() => setPhoneOpen((v) => !v)}
        >
          {icon('phone', '#16a34a')}
        </button>
      </div>
      <Link href={`${home}/chat`} className="round-contact-btn" aria-label={labels.chat}>
        <span className="round-contact-chat-text">{labels.chat}</span>
      </Link>
      <Link href={`${home}/mypage`} className="round-contact-btn" aria-label={labels.mypage}>
        {icon('user', 'var(--c-title)')}
      </Link>
    </nav>
  )
}
