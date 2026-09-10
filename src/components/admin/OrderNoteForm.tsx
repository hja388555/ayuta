'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { adminErrorMessage } from '@/lib/admin/error-messages'
import { button, errorBox, input } from './styles'

/**
 * 연락메모 작성 폼.
 *
 * Payload REST(/api/order-notes)가 아니라 /api/admin/orders/notes 를 부른다 —
 * REST 는 2단계 인증을 모르기 때문이다(라우트 주석 참고). 메모는 append-only 라
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
    <div>
      <textarea
        style={{ ...input, width: '100%', minHeight: 80, display: 'block' }}
        placeholder="고객과 연락한 내용을 남기세요. 저장 후에는 수정·삭제할 수 없습니다."
        value={body}
        maxLength={5000}
        onChange={(e) => setBody(e.target.value)}
        disabled={busy}
      />
      <button type="button" style={{ ...button, marginTop: 8 }} onClick={submit} disabled={busy}>
        {busy ? '저장 중…' : '메모 추가'}
      </button>
      {error ? <p style={errorBox}>{error}</p> : null}
    </div>
  )
}
