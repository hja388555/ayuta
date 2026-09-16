'use client'

import Link from 'next/link'
import { useState } from 'react'
import c from './Chat.module.css'

export type GuestGateLabels = {
  title: string
  desc: string
  signup: string
  login: string
  inquiry: string
}

/**
 * 비로그인으로 1:1 상담에 들어오면 먼저 회원가입을 권한다(2026-09-16 사용자).
 * 비회원 문의 자체는 그대로 열어 둔다 — [급한 문의만 남기기] 를 누르면 기존 시작 폼이 나온다.
 * 폼은 서버에서 그려 자식으로 받는다. 이 컴포넌트는 보여 줄지 말지만 정한다.
 */
export function GuestChatGate({ locale, labels, children }: { locale: 'ko' | 'ja'; labels: GuestGateLabels; children: React.ReactNode }) {
  const [showForm, setShowForm] = useState(false)
  if (showForm) return <>{children}</>
  return (
    <div className={c.gate}>
      <p id="guest-chat-gate-title" className={c.gateTitle}>{labels.title}</p>
      <p className={c.gateDesc}>{labels.desc}</p>
      <Link href={`/${locale}/signup?next=/${locale}/chat`} className={`btn btn-primary ${c.gateBtn}`}>
        {labels.signup}
      </Link>
      <Link href={`/${locale}/login?next=/${locale}/chat`} className={`btn btn-secondary ${c.gateBtn}`}>
        {labels.login}
      </Link>
      <button type="button" className={c.gateInquiry} onClick={() => setShowForm(true)}>
        {labels.inquiry}
      </button>
    </div>
  )
}
