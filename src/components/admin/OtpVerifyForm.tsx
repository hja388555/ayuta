'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { adminErrorMessage } from '@/lib/admin/error-messages'
import { button, errorBox, input } from './styles'

/** 6자리 코드 입력 + 다시 받기. 다시 받기는 서버가 1시간 5회로 제한한다 */
export function OtpVerifyForm({ email }: { email: string }) {
  const router = useRouter()
  const [code, setCode] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)

  async function verify(e: React.FormEvent) {
    e.preventDefault()
    if (busy) return
    if (!/^\d{6}$/.test(code)) {
      setError(adminErrorMessage('invalid_code'))
      return
    }
    setBusy(true)
    setError(null)
    setNotice(null)
    try {
      const res = await fetch('/api/admin/otp/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code }),
      })
      const body = await res.json().catch(() => ({}))
      if (!res.ok || !body?.ok) {
        setError(adminErrorMessage(body?.error))
        setCode('')
        return
      }
      router.replace('/manage')
      router.refresh()
    } catch {
      setError(adminErrorMessage('network'))
    } finally {
      setBusy(false)
    }
  }

  async function resend() {
    if (busy) return
    setBusy(true)
    setError(null)
    setNotice(null)
    try {
      const res = await fetch('/api/admin/otp/issue', { method: 'POST' })
      const body = await res.json().catch(() => ({}))
      if (!res.ok) {
        setError(adminErrorMessage(body?.error))
        return
      }
      setNotice('새 코드를 보냈습니다. 이전 코드는 더 이상 쓸 수 없습니다.')
    } catch {
      setError(adminErrorMessage('network'))
    } finally {
      setBusy(false)
    }
  }

  return (
    <form onSubmit={verify} style={{ display: 'grid', gap: 12, maxWidth: 320 }}>
      <p style={{ fontSize: 13, color: '#767B85', margin: 0 }}>{email} 로 보낸 6자리 코드를 입력해 주세요. (10분 안에)</p>
      <input
        style={{ ...input, fontSize: 20, letterSpacing: 8, textAlign: 'center' }}
        inputMode="numeric"
        autoComplete="one-time-code"
        maxLength={6}
        aria-label="확인 코드 6자리"
        value={code}
        onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
        disabled={busy}
      />
      <button type="submit" style={button} disabled={busy || code.length !== 6}>
        {busy ? '확인 중…' : '확인'}
      </button>
      <button type="button" style={{ ...button, background: '#fff', color: '#3D4046', border: '1px solid #D6D9DE' }} onClick={resend} disabled={busy}>
        코드 다시 받기
      </button>
      {notice ? <p style={{ fontSize: 13, color: '#2E7D32', margin: 0 }}>{notice}</p> : null}
      {error ? <p style={errorBox}>{error}</p> : null}
    </form>
  )
}
