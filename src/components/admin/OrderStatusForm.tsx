'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { adminErrorMessage, GENERIC_ERROR } from '@/lib/admin/error-messages'
import { button, errorBox, input, label, okBox } from './styles'

type Props = {
  orderId: number
  currentLabel: string
  /** 서버가 ALLOWED 전이표로 이미 걸러낸 후보. 화면은 이 목록만 보여준다 */
  options: { value: string; label: string }[]
}

/**
 * 상태 변경 폼.
 *
 * 후보 목록은 서버(availableTransitions)가 만들어 넘긴다 — 여기서 다시 판단하지
 * 않는다. 화면과 서버가 각자 전이 규칙을 들고 있으면 언젠가 갈라진다.
 * 저장 성공 후에는 router.refresh() 로 서버 컴포넌트를 다시 그린다 — 상태가 바뀌면
 * 다음에 갈 수 있는 후보와 이력 표가 통째로 달라지므로 부분 갱신이 의미가 없다.
 */
export function OrderStatusForm({ orderId, currentLabel, options }: Props) {
  const router = useRouter()
  const [to, setTo] = useState('')
  const [reason, setReason] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [done, setDone] = useState(false)

  if (options.length === 0) {
    return <p style={{ fontSize: 13, color: '#767B85' }}>현재 상태({currentLabel})에서 바꿀 수 있는 상태가 없습니다.</p>
  }

  async function submit() {
    if (!to || busy) return
    setBusy(true)
    setError(null)
    setDone(false)
    try {
      const res = await fetch('/api/admin/orders/transition', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orderId, to, reason: reason.trim() || undefined }),
      })
      const body = await res.json().catch(() => ({}))
      if (!res.ok || !body?.ok) {
        setError(adminErrorMessage(body?.error))
        return
      }
      setTo('')
      setReason('')
      setDone(true)
      router.refresh()
    } catch {
      // 네트워크 자체가 끊긴 경우. 서버가 준 코드가 없으므로 별도 문구를 쓴다
      setError(adminErrorMessage('network'))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div>
      <label style={label} htmlFor="status-to">
        바꿀 상태
      </label>
      <select
        id="status-to"
        style={{ ...input, marginRight: 8 }}
        value={to}
        onChange={(e) => setTo(e.target.value)}
        disabled={busy}
      >
        <option value="">선택하세요</option>
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
      <input
        style={{ ...input, width: 320, marginRight: 8 }}
        placeholder="사유 (선택, 이력에 남습니다)"
        value={reason}
        maxLength={500}
        onChange={(e) => setReason(e.target.value)}
        disabled={busy}
      />
      <button type="button" style={button} onClick={submit} disabled={!to || busy}>
        {busy ? '변경 중…' : '상태 변경'}
      </button>
      {error ? <p style={errorBox}>{error || GENERIC_ERROR}</p> : null}
      {done ? <p style={okBox}>상태를 변경했습니다.</p> : null}
    </div>
  )
}
