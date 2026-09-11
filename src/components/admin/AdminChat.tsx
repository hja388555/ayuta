'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { Badge } from '@/components/ui'
import { Composer, MessageList, mergeMessages, useVisiblePolling, type ChatMessageView } from '@/components/ChatRoom'
import c from '@/components/Chat.module.css'
import s from './AdminChat.module.css'

type ThreadItem = {
  id: number
  locale: 'ko' | 'ja'
  status: 'open' | 'closed'
  lastMessageAt: string | null
  unreadForAdmin: number
  customerName: string | null
  customerEmail: string | null
  preview: string | null
}

const POLL_MS = 5000
const ERRORS: Record<number, string> = {
  400: '메시지를 확인해 주세요(1~2000자).',
  401: '로그인이 만료되었습니다. 다시 로그인해 주세요.',
  403: '권한이 없습니다.',
  404: '대화를 찾을 수 없습니다.',
  429: '너무 빠르게 보내고 있습니다. 잠시 후 다시 시도해 주세요.',
}
const when = (iso: string | null) =>
  iso ? new Intl.DateTimeFormat('ko-KR', { timeZone: 'Asia/Seoul', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false }).format(new Date(iso)) : ''

/** [v2] A9 문의·채팅의 1:1 채팅 탭. 왼쪽 방 목록, 오른쪽 대화(원문 + 한국어 번역). 5초마다 갱신 */
export function AdminChat() {
  const [threads, setThreads] = useState<ThreadItem[] | null>(null)
  const [selected, setSelected] = useState<number | null>(null)
  const [messages, setMessages] = useState<ChatMessageView[]>([])
  const [text, setText] = useState('')
  const [sending, setSending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const listRef = useRef<HTMLDivElement>(null)
  const current = threads?.find((t) => t.id === selected) ?? null
  const lastId = messages.length ? messages[messages.length - 1]!.id : 0

  const loadThreads = useCallback(async () => {
    const res = await fetch('/api/admin/chat/threads', { cache: 'no-store' }).catch(() => null)
    if (!res?.ok) return
    setThreads(((await res.json()) as { threads: ThreadItem[] }).threads)
  }, [])

  const markRead = useCallback((id: number) => {
    fetch(`/api/admin/chat/threads/${id}/read`, { method: 'POST' }).catch(() => {})
    setThreads((prev) => prev?.map((t) => (t.id === id ? { ...t, unreadForAdmin: 0 } : t)) ?? prev)
  }, [])

  useEffect(() => {
    void loadThreads()
  }, [loadThreads])

  useEffect(() => {
    if (selected === null) return
    let alive = true
    setMessages([])
    setError(null)
    fetch(`/api/admin/chat/threads/${selected}/messages`, { cache: 'no-store' })
      .then(async (res) => {
        if (!res.ok) throw new Error(String(res.status))
        const data = (await res.json()) as { messages: ChatMessageView[] }
        if (alive) setMessages(data.messages)
        markRead(selected)
      })
      .catch(() => alive && setError('대화를 불러오지 못했습니다.'))
    return () => {
      alive = false
    }
  }, [selected, markRead])

  const poll = useCallback(async () => {
    void loadThreads()
    if (selected === null) return
    const res = await fetch(`/api/admin/chat/threads/${selected}/messages?after=${lastId}`, { cache: 'no-store' }).catch(() => null)
    if (!res?.ok) return
    const data = (await res.json()) as { messages: ChatMessageView[] }
    if (data.messages.length === 0) return
    setMessages((prev) => mergeMessages(prev, data.messages))
    if (data.messages.some((m) => m.sender === 'customer')) markRead(selected)
  }, [loadThreads, selected, lastId, markRead])
  useVisiblePolling(poll, POLL_MS, true)

  useEffect(() => {
    const el = listRef.current
    if (el) el.scrollTop = el.scrollHeight
  }, [messages.length, selected])

  async function send() {
    const body = text.trim()
    if (!body || sending || selected === null) return
    setSending(true)
    setError(null)
    try {
      const res = await fetch(`/api/admin/chat/threads/${selected}/messages`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ body }) })
      if (!res.ok) {
        setError(ERRORS[res.status] ?? '보내지 못했습니다. 잠시 후 다시 시도해 주세요.')
        return
      }
      const data = (await res.json()) as { message: ChatMessageView }
      setMessages((prev) => mergeMessages(prev, [data.message]))
      setText('')
      void loadThreads()
    } catch {
      setError('보내지 못했습니다. 잠시 후 다시 시도해 주세요.')
    } finally {
      setSending(false)
    }
  }

  async function toggleStatus() {
    if (!current) return
    const status = current.status === 'open' ? 'closed' : 'open'
    const res = await fetch(`/api/admin/chat/threads/${current.id}/status`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status }) }).catch(() => null)
    if (!res?.ok) {
      setError(ERRORS[res?.status ?? 0] ?? '상태를 바꾸지 못했습니다.')
      return
    }
    setThreads((prev) => prev?.map((t) => (t.id === current.id ? { ...t, status } : t)) ?? prev)
  }

  return (
    <div className={selected === null ? s.wrap : `${s.wrap} ${s.hasSelection}`}>
      <section className={s.list} aria-label="채팅 목록">
        {threads === null ? <p className={s.muted}>불러오는 중…</p> : null}
        {threads?.length === 0 ? <p className={s.muted}>아직 채팅이 없습니다.</p> : null}
        {threads?.map((t) => (
          <button key={t.id} type="button" className={t.id === selected ? `${s.thread} ${s.threadActive}` : s.thread} onClick={() => setSelected(t.id)} aria-current={t.id === selected ? 'true' : undefined}>
            <span className={s.threadHead}>
              <span className={s.threadName}>{t.customerName ?? '(이름 없음)'}</span>
              {t.unreadForAdmin > 0 ? <span className={s.unread}>{t.unreadForAdmin}</span> : null}
              <Badge tone={t.status === 'open' ? 'brand' : 'neutral'}>{t.status === 'open' ? '진행 중' : '종료'}</Badge>
            </span>
            <span className={s.threadMeta}>
              {t.customerEmail ?? ''} · {t.locale === 'ja' ? '日本語' : '한국어'} · {when(t.lastMessageAt)}
            </span>
            <span className={s.preview}>{t.preview ?? '메시지 없음'}</span>
          </button>
        ))}
      </section>

      <section className={s.room} aria-label="대화">
        {current ? (
          <>
            <div className={s.roomHead}>
              <button type="button" className={`btn btn-outline ${s.back}`} onClick={() => setSelected(null)}>
                목록
              </button>
              <div className={s.roomWho}>
                <strong>{current.customerName ?? '(이름 없음)'}</strong>
                <span>
                  {current.customerEmail ?? ''} · {current.locale === 'ja' ? '일본어로 번역해 전달' : '한국어 방(번역 없음)'}
                </span>
              </div>
              <button type="button" className="btn btn-outline" onClick={toggleStatus}>
                {current.status === 'open' ? '채팅 종료' : '다시 열기'}
              </button>
            </div>
            <div className={`${c.card} ${s.messages}`} ref={listRef} aria-live="polite">
              {messages.length === 0 ? <p className={c.empty}>메시지가 없습니다.</p> : null}
              <MessageList messages={messages} viewer="ko" mine="admin" locale="ko" failedLabel="번역 실패 — 원문만 전달됨" />
            </div>
            {error ? (
              <p className={c.error} role="alert">
                {error}
              </p>
            ) : null}
            <Composer value={text} onChange={setText} onSend={send} sending={sending} placeholder="답장을 입력하세요" sendLabel="보내기" attachLabel="파일 첨부 (준비 중)" />
          </>
        ) : (
          <p className={s.muted}>왼쪽에서 채팅을 선택하세요.</p>
        )}
      </section>
    </div>
  )
}
