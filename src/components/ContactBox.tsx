'use client'

import Link from 'next/link'
import { useState } from 'react'
import { LoginRequiredModal } from './LoginRequiredModal'

/**
 * 본문 하단 문의 박스(큐 Q32, Figma [v2] 205:102 PC / 207:94 Mobile). 모든 고객 화면 공통.
 * 채팅 버튼은 1:1 채팅(큐 Q37)을 연다. 비회원이면 이동하지 않고 로그인 유도 팝업을 띄운다.
 */
export function ContactBox({
  phone,
  locale,
  loggedIn,
  labels,
}: {
  phone: string
  locale: string
  loggedIn: boolean
  labels: { title: string; hours: string; chat: string; loginBody1: string; loginBody2: string }
}) {
  const [askLogin, setAskLogin] = useState(false)
  const chatHref = `/${locale}/chat`
  return (
    <section className="contact-box" aria-labelledby="contact-box-title">
      <div className="contact-box-text">
        <h2 id="contact-box-title">{labels.title}</h2>
        <p>{labels.hours}</p>
      </div>
      <div className="contact-box-actions">
        <a className="btn btn-lg btn-outline" href={`tel:${phone.replace(/[^\d+]/g, '')}`}>
          <img className="btn-icon" src="/ui/contact-phone.svg" alt="" width={20} height={20} />
          {phone}
        </a>
        <Link
          className="btn btn-lg btn-primary"
          href={chatHref}
          onClick={(e) => {
            if (loggedIn) return
            e.preventDefault()
            setAskLogin(true)
          }}
        >
          <img className="btn-icon" src="/ui/chat.svg" alt="" width={20} height={20} />
          {labels.chat}
        </Link>
      </div>
      <LoginRequiredModal locale={locale} open={askLogin} onClose={() => setAskLogin(false)} next={chatHref} body={[labels.loginBody1, labels.loginBody2]} />
    </section>
  )
}
