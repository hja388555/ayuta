'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { adminErrorMessage } from '@/lib/admin/error-messages'
import { button, errorBox, input } from './styles'

type Target = { target: 'contract'; id: number } | { target: 'document'; kind: 'terms' | 'privacy'; locale: 'ko' | 'ja' }

/**
 * 계약서·약관 문구 편집기(큐 Q25 2차). 저장하면 다음 주문·다음 방문부터 반영된다.
 * 이미 체결된 계약서는 주문에 복사된 원문이라 바뀌지 않는다 — 저장 전에 한 번 더 묻는다.
 */
export function LegalEditor({ target, initialTitle, initialBody, canEdit }: { target: Target; initialTitle: string; initialBody: string; canEdit: boolean }) {
  const router = useRouter()
  const [title, setTitle] = useState(initialTitle)
  const [body, setBody] = useState(initialBody)
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null)
  const dirty = title !== initialTitle || body !== initialBody

  async function save() {
    if (busy || !dirty) return
    if (!window.confirm('저장하면 다음 주문(방문)부터 이 문구가 쓰입니다. 이미 체결된 계약서는 바뀌지 않습니다. 저장할까요?')) return
    setBusy(true)
    setMsg(null)
    try {
      const res = await fetch('/api/admin/legal', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...target, title, body }) })
      const json = await res.json().catch(() => ({}))
      if (!res.ok || !json?.ok) {
        const detail = Array.isArray(json?.detail) ? ` (${json.detail.map((k: string) => `{{${k}}}`).join(', ')})` : ''
        return setMsg({ ok: false, text: adminErrorMessage(json?.error) + detail })
      }
      setMsg({ ok: true, text: '저장했습니다. 수정 이력에 남았습니다.' })
      router.refresh()
    } catch {
      setMsg({ ok: false, text: adminErrorMessage('network') })
    } finally {
      setBusy(false)
    }
  }

  return (
    <div style={{ display: 'grid', gap: 8 }}>
      <input style={input} value={title} onChange={(e) => setTitle(e.target.value)} disabled={!canEdit || busy} aria-label="제목" />
      <textarea
        style={{ ...input, minHeight: 320, lineHeight: 1.6, whiteSpace: 'pre-wrap' }}
        value={body}
        onChange={(e) => setBody(e.target.value)}
        disabled={!canEdit || busy}
        aria-label="본문"
      />
      {canEdit ? (
        <button type="button" style={{ ...button, justifySelf: 'start', opacity: dirty ? 1 : 0.5 }} onClick={save} disabled={busy || !dirty}>
          {busy ? '저장 중…' : '저장'}
        </button>
      ) : null}
      {msg ? <p style={msg.ok ? { fontSize: 13, color: '#2E7D32', margin: 0 } : errorBox}>{msg.text}</p> : null}
    </div>
  )
}
