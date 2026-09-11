'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { adminErrorMessage } from '@/lib/admin/error-messages'
import { button, errorBox, input } from './styles'

type Target = { target: 'contract'; id: number } | { target: 'document'; kind: 'terms' | 'privacy'; locale: 'ko' | 'ja' }
type Consent = { key: string; label: string; required: boolean }

/**
 * 계약서·약관 문구 편집기(큐 Q25 2차). 저장하면 다음 주문·다음 방문부터 반영된다.
 * 이미 체결된 계약서는 주문에 복사된 원문이라 바뀌지 않는다 — 저장 전에 한 번 더 묻는다.
 * 계약서는 결제 화면의 동의 체크박스 문구도 여기서 고친다(3차). 항목 개수·필수 여부는 고정.
 */
export function LegalEditor({
  target,
  initialTitle,
  initialBody,
  initialConsents,
  canEdit,
}: {
  target: Target
  initialTitle: string
  initialBody: string
  initialConsents?: Consent[]
  canEdit: boolean
}) {
  const router = useRouter()
  const [title, setTitle] = useState(initialTitle)
  const [body, setBody] = useState(initialBody)
  const [consents, setConsents] = useState(initialConsents ?? [])
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null)
  const consentsDirty = JSON.stringify(consents) !== JSON.stringify(initialConsents ?? [])
  const dirty = title !== initialTitle || body !== initialBody || consentsDirty

  async function save() {
    if (busy || !dirty) return
    if (!window.confirm('저장하면 다음 주문(방문)부터 이 문구가 쓰입니다. 이미 체결된 계약서는 바뀌지 않습니다. 저장할까요?')) return
    setBusy(true)
    setMsg(null)
    try {
      const payload = {
        ...target,
        title,
        body,
        ...(target.target === 'contract' && consentsDirty ? { consents: consents.map(({ key, label }) => ({ key, label })) } : {}),
      }
      const res = await fetch('/api/admin/legal', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) })
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
      {consents.length > 0 ? (
        <fieldset style={{ border: '1px solid #ECEEF1', borderRadius: 4, padding: 12, display: 'grid', gap: 6 }}>
          <legend style={{ fontSize: 13 }}>결제 화면 동의 체크박스 문구</legend>
          {consents.map((c, i) => (
            <label key={c.key} style={{ fontSize: 13 }}>
              {i + 1}. {c.required ? '[필수]' : '[선택]'}
              <input
                style={{ ...input, display: 'block', width: '100%', marginTop: 4 }}
                value={c.label}
                onChange={(e) => setConsents(consents.map((x, j) => (j === i ? { ...x, label: e.target.value } : x)))}
                disabled={!canEdit || busy}
              />
            </label>
          ))}
          <span style={{ fontSize: 12, color: '#767B85' }}>항목 개수와 필수 여부는 바꿀 수 없습니다(결제 검증과 연결돼 있음).</span>
        </fieldset>
      ) : null}
      {canEdit ? (
        <button type="button" style={{ ...button, justifySelf: 'start', opacity: dirty ? 1 : 0.5 }} onClick={save} disabled={busy || !dirty}>
          {busy ? '저장 중…' : '저장'}
        </button>
      ) : null}
      {msg ? <p style={msg.ok ? { fontSize: 13, color: '#2E7D32', margin: 0 } : errorBox}>{msg.text}</p> : null}
    </div>
  )
}
