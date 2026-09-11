import type { ReactNode } from 'react'
import s from './Chat.module.css'

/**
 * 1:1 채팅 화면의 머리글(제목 + 번역 배지)과 하단 안내. 회원 대화방과 비회원 시작 폼이 같이 쓴다(Figma [v2] 12 · 12-B).
 */
export function ChatFrame({ title, badge, notices, children }: { title: string; badge: string; notices: string[]; children: ReactNode }) {
  return (
    <div className={s.page}>
      <div className={s.head}>
        <h1 className={s.title}>{title}</h1>
        <span className={s.badge}>
          <img src="/ui/chat-globe.svg" alt="" width={16} height={16} />
          {badge}
        </span>
      </div>
      {children}
      <div className={s.notice}>
        {notices.map((n) => (
          <p key={n}>{n}</p>
        ))}
      </div>
    </div>
  )
}
