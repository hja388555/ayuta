'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { isHeaderHidden } from '../lib/header-visibility'

type ContactLabels = { chat: string; call: string }

/**
 * PC(≥768px) 전용 상담 둥근 버튼 두 개 — 1:1 채팅 · 전화(6라운드, 큐 클라이언트 4라운드 C 대체).
 * 헤더가 있는 화면은 SiteHeader 가 로그인 옆에 바로 넣고(className 없이), 헤더가 없는 1~4번은
 * `round-contact-fixed` 로 화면 오른쪽 위에 띄운다. 모바일은 하단 탭바가 같은 기능을 맡아
 * globals.css 의 `.round-contact` 로 숨긴다.
 */
export function RoundContactButtons({
  locale,
  phone,
  labels,
  className = '',
}: {
  locale: string
  phone: string
  labels: ContactLabels
  className?: string
}) {
  return (
    <div className={`round-contact ${className}`.trim()}>
      <Link href={`/${locale}/chat`} className="round-contact-btn round-contact-chat" aria-label={labels.chat}>
        <span className="icon-mask" style={{ ['--icon-url' as string]: "url('/ui/tab-chat.svg')" }} aria-hidden />
      </Link>
      <a href={`tel:${phone.replace(/[^\d+]/g, '')}`} className="round-contact-btn round-contact-call" aria-label={labels.call}>
        <span className="icon-mask" style={{ ['--icon-url' as string]: "url('/ui/tab-phone.svg')" }} aria-hidden />
      </a>
    </div>
  )
}

/** 헤더가 없는 화면(1~4번, PC)에서만 오른쪽 위에 고정 노출한다(경로 판정: header-visibility) */
export function FloatingContact({ locale, phone, labels }: { locale: string; phone: string; labels: ContactLabels }) {
  const pathname = usePathname() ?? `/${locale}`
  if (!isHeaderHidden(pathname)) return null
  return <RoundContactButtons locale={locale} phone={phone} labels={labels} className="round-contact-fixed" />
}
