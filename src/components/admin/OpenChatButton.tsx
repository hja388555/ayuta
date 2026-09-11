'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'

const ERRORS: Record<string, string> = {
  not_found: '대상을 찾을 수 없습니다.',
  guest_order: '비회원 주문 — 연락처로 안내해 주세요.',
  unauthenticated: '로그인이 만료되었습니다. 다시 로그인해 주세요.',
  forbidden: '권한이 없습니다.',
}

/**
 * 관리자 "채팅 열기"(Figma A9 230:232). 문의·주문의 고객 방을 서버가 찾거나 만든 뒤
 * 문의·채팅 화면의 1:1 채팅 탭에서 그 방을 연다.
 */
export function OpenChatButton({ target, className, label = '채팅 열기' }: { target: { inquiryId: number } | { orderId: number }; className?: string; label?: string }) {
  const router = useRouter()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function open() {
    if (busy) return
    setBusy(true)
    setError(null)
    try {
      const res = await fetch('/api/admin/chat/open', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(target) })
      const body = (await res.json().catch(() => ({}))) as { ok?: boolean; threadId?: number; error?: string }
      if (!res.ok || !body.threadId) {
        setError(ERRORS[body.error ?? ''] ?? '채팅을 열지 못했습니다. 잠시 후 다시 시도해 주세요.')
        return
      }
      router.push(`/manage/inquiries?tab=chat&thread=${body.threadId}`)
    } catch {
      setError('네트워크 오류가 발생했습니다.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <>
      <button type="button" className={className} onClick={open} disabled={busy} title={error ?? undefined}>
        {busy ? '여는 중…' : label}
      </button>
      {error ? (
        <span role="alert" style={{ color: '#c62828', fontSize: 13 }}>
          {error}
        </span>
      ) : null}
    </>
  )
}
