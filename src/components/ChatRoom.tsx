'use client'

import { Fragment, useCallback, useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { bubbleText, MAX_BODY, type ChatLocale } from '@/lib/chat/rules'
import { ChatFrame } from './ChatFrame'
import s from './Chat.module.css'

export type ChatMessageView = {
  id: number
  sender: 'customer' | 'admin'
  body: string
  translatedBody: string | null
  sourceLang: string | null
  translatedLang: string | null
  translationStatus: 'ok' | 'failed' | 'skipped'
  createdAt: string
  senderEmail?: string | null
}

type Labels = {
  title: string
  badge: string
  placeholder: string
  send: string
  attach: string
  notice1: string
  notice2: string
  empty: string
  closed: string
  sendError: string
  rateLimited: string
  loadError: string
  translationFailed: string
  loading: string
}

const POLL_MS = 4000

export const kstDay = (iso: string, locale: string) =>
  new Intl.DateTimeFormat(locale === 'ja' ? 'ja-JP' : 'ko-KR', { timeZone: 'Asia/Seoul', year: 'numeric', month: 'long', day: 'numeric' }).format(new Date(iso))
export const kstTime = (iso: string) =>
  new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Seoul', hour: '2-digit', minute: '2-digit', hour12: false }).format(new Date(iso))

/** 새로 받은 메시지를 id 기준으로 합친다(폴링과 전송 응답이 겹쳐도 한 번만) */
export function mergeMessages(prev: ChatMessageView[], next: ChatMessageView[]): ChatMessageView[] {
  if (next.length === 0) return prev
  const seen = new Set(prev.map((m) => m.id))
  const add = next.filter((m) => !seen.has(m.id))
  return add.length === 0 ? prev : [...prev, ...add].sort((a, b) => a.id - b.id)
}

/** 날짜 칩 + 말풍선 + 시각. 고객 화면·관리자 화면이 같이 쓴다 — mine 이 오른쪽 파란 말풍선 */
export function MessageList({
  messages,
  viewer,
  mine,
  locale,
  failedLabel,
}: {
  messages: ChatMessageView[]
  viewer: ChatLocale
  mine: 'customer' | 'admin'
  locale: string
  failedLabel: string
}) {
  let lastDay = ''
  return (
    <>
      {messages.map((m) => {
        const day = kstDay(m.createdAt, locale)
        const showDay = day !== lastDay
        lastDay = day
        const own = m.sender === mine
        const text = bubbleText(m, viewer)
        return (
          <Fragment key={m.id}>
            {showDay ? (
              <div className={s.dayRow}>
                <span className={s.day}>{day}</span>
              </div>
            ) : null}
            <div className={own ? `${s.row} ${s.rowMine}` : s.row}>
              <div className={own ? `${s.bubble} ${s.bubbleMine}` : s.bubble}>
                <p className={s.primary}>{text.primary}</p>
                {text.secondary ? (
                  <>
                    <span className={s.rule} aria-hidden="true" />
                    <p className={s.secondary}>{text.secondary}</p>
                  </>
                ) : m.translationStatus === 'failed' ? (
                  <>
                    <span className={s.rule} aria-hidden="true" />
                    <p className={s.secondary}>{failedLabel}</p>
                  </>
                ) : null}
              </div>
            </div>
            <div className={own ? `${s.row} ${s.rowMine}` : s.row}>
              <time className={s.time} dateTime={m.createdAt}>
                {kstTime(m.createdAt)}
              </time>
            </div>
          </Fragment>
        )
      })}
    </>
  )
}

/** 보내기 입력줄. Enter 로 보내고 Shift+Enter 로 줄바꿈. 첨부는 준비 중(비활성) */
export function Composer({
  value,
  onChange,
  onSend,
  sending,
  placeholder,
  sendLabel,
  attachLabel,
}: {
  value: string
  onChange: (v: string) => void
  onSend: () => void
  sending: boolean
  placeholder: string
  sendLabel: string
  attachLabel: string
}) {
  return (
    <form
      className={s.composer}
      onSubmit={(e) => {
        e.preventDefault()
        onSend()
      }}
    >
      <button type="button" className={s.attach} disabled aria-label={attachLabel} title={attachLabel}>
        <img src="/ui/chat-upload.svg" alt="" width={18} height={18} />
      </button>
      <textarea
        className={s.input}
        value={value}
        rows={1}
        maxLength={MAX_BODY}
        placeholder={placeholder}
        aria-label={placeholder}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
            e.preventDefault()
            onSend()
          }
        }}
      />
      <button type="submit" className={s.send} disabled={sending || value.trim().length === 0}>
        {sendLabel}
      </button>
    </form>
  )
}

/** 창이 보일 때만 주기적으로 fn 을 부른다. 다시 보이면 곧바로 한 번 */
export function useVisiblePolling(fn: () => void, ms: number, enabled: boolean) {
  const ref = useRef(fn)
  ref.current = fn
  useEffect(() => {
    if (!enabled) return
    const tick = () => {
      if (!document.hidden) ref.current()
    }
    const id = setInterval(tick, ms)
    const onVisible = () => {
      if (!document.hidden) ref.current()
    }
    document.addEventListener('visibilitychange', onVisible)
    return () => {
      clearInterval(id)
      document.removeEventListener('visibilitychange', onVisible)
    }
  }, [ms, enabled])
}

/** 고객 1:1 채팅(Figma [v2] 12). 4초마다 새 메시지를 가져오고, 열 때·새 답장이 올 때 읽음 처리 */
export function ChatRoom({ locale, labels, guest }: { locale: ChatLocale; labels: Labels; guest?: { leave: string; leaveConfirm: string } }) {
  const router = useRouter()
  const [leaving, setLeaving] = useState(false)
  const [messages, setMessages] = useState<ChatMessageView[]>([])
  const [status, setStatus] = useState<'open' | 'closed'>('open')
  const [loaded, setLoaded] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [text, setText] = useState('')
  const [sending, setSending] = useState(false)
  const listRef = useRef<HTMLDivElement>(null)
  const lastId = messages.length ? messages[messages.length - 1]!.id : 0

  const markRead = () => fetch('/api/chat/read', { method: 'POST' }).catch(() => {})

  useEffect(() => {
    let alive = true
    fetch(`/api/chat/thread?locale=${locale}`, { cache: 'no-store' })
      .then(async (res) => {
        if (!res.ok) throw new Error(String(res.status))
        const data = (await res.json()) as { thread: { status: 'open' | 'closed' }; messages: ChatMessageView[] }
        if (!alive) return
        setMessages(data.messages)
        setStatus(data.thread.status)
        setLoaded(true)
        markRead()
      })
      .catch(() => alive && setError(labels.loadError))
    return () => {
      alive = false
    }
  }, [locale, labels.loadError])

  const poll = useCallback(async () => {
    try {
      const res = await fetch(`/api/chat/messages?after=${lastId}`, { cache: 'no-store' })
      if (!res.ok) return
      const data = (await res.json()) as { status: 'open' | 'closed'; messages: ChatMessageView[] }
      setStatus(data.status)
      if (data.messages.length > 0) {
        setMessages((prev) => mergeMessages(prev, data.messages))
        if (data.messages.some((m) => m.sender === 'admin')) markRead()
      }
    } catch {
      // 다음 주기에 다시 시도한다
    }
  }, [lastId])
  useVisiblePolling(poll, POLL_MS, loaded)

  // 보낼 때의 창 스크롤 위치. 새 말풍선이 붙어도 스크롤은 대화 목록 안에서만 움직이고 페이지는 그대로 둔다(모바일)
  const keepPageY = useRef<number | null>(null)
  useEffect(() => {
    const el = listRef.current
    if (el) el.scrollTop = el.scrollHeight
    if (keepPageY.current !== null && Math.abs(window.scrollY - keepPageY.current) > 1) window.scrollTo({ top: keepPageY.current })
    keepPageY.current = null
  }, [messages.length])

  async function leave() {
    if (!guest || leaving || !window.confirm(guest.leaveConfirm)) return
    setLeaving(true)
    await fetch('/api/chat/guest', { method: 'DELETE' }).catch(() => {})
    // 쿠키가 없어졌으니 같은 주소가 시작 폼으로 다시 그려진다
    router.refresh()
  }

  async function send() {
    const body = text.trim()
    if (!body || sending) return
    keepPageY.current = window.scrollY
    setSending(true)
    setError(null)
    try {
      const res = await fetch('/api/chat/messages', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ body }) })
      if (!res.ok) {
        setError(res.status === 429 ? labels.rateLimited : labels.sendError)
        return
      }
      const data = (await res.json()) as { message: ChatMessageView }
      setMessages((prev) => mergeMessages(prev, [data.message]))
      setStatus('open')
      setText('')
    } catch {
      setError(labels.sendError)
    } finally {
      setSending(false)
    }
  }

  return (
    <ChatFrame title={labels.title} badge={labels.badge} notices={[labels.notice1, labels.notice2]}>
      <div className={s.card} ref={listRef} aria-live="polite">
        {!loaded && !error ? <p className={s.empty}>{labels.loading}</p> : null}
        {loaded && messages.length === 0 ? <p className={s.empty}>{labels.empty}</p> : null}
        <MessageList messages={messages} viewer={locale} mine="customer" locale={locale} failedLabel={labels.translationFailed} />
        {loaded && status === 'closed' ? <p className={s.empty}>{labels.closed}</p> : null}
      </div>

      {error ? (
        <p className={s.error} role="alert">
          {error}
        </p>
      ) : null}
      <Composer value={text} onChange={setText} onSend={send} sending={sending || !loaded} placeholder={labels.placeholder} sendLabel={labels.send} attachLabel={labels.attach} />
      {guest ? (
        <button type="button" className={s.leave} onClick={leave} disabled={leaving}>
          {guest.leave}
        </button>
      ) : null}
    </ChatFrame>
  )
}
