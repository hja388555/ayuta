'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { adminErrorMessage } from '@/lib/admin/error-messages'
import { errorBox } from './styles'
import s from './AdminOrders.module.css'

/**
 * 연락메모 작성 폼.
 *
 * Payload REST(/api/order-notes)가 아니라 /api/admin/orders/notes 를 부른다 —
 * 응답 규약과 에러 번역표를 관리자 API 하나로 맞춘다(라우트 주석 참고). 메모는 append-only 라
 * 저장 후 수정·삭제 수단을 두지 않는다.
 */
export function OrderNoteForm({ orderId }: { orderId: number }) {
  const router = useRouter()
  const [body, setBody] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function submit() {
    const text = body.trim()
    if (busy) return
    if (!text) {
      setError(adminErrorMessage('empty_note'))
      return
    }
    setBusy(true)
    setError(null)
    try {
      const res = await fetch('/api/admin/orders/notes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orderId, body: text }),
      })
      const payload = await res.json().catch(() => ({}))
      if (!res.ok || !payload?.ok) {
        setError(adminErrorMessage(payload?.error))
        return
      }
      setBody('')
      router.refresh()
    } catch {
      setError(adminErrorMessage('network'))
    } finally {
      setBusy(false)
    }
  }

  return (
    <>
      <textarea
        className={s.textarea}
        aria-label="연락 메모"
        placeholder="통화 내용 · 진행 상황을 기록하세요 (저장 후 수정·삭제할 수 없습니다)"
        value={body}
        maxLength={5000}
        onChange={(e) => setBody(e.target.value)}
        disabled={busy}
      />
      <button type="button" className={`btn btn-secondary btn-block ${s.bigBtn}`} onClick={submit} disabled={busy}>
        {busy ? '저장 중…' : '메모 추가'}
      </button>
      {error ? <p style={errorBox}>{error}</p> : null}
    </>
  )
}
