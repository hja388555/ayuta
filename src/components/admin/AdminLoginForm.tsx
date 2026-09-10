'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { adminErrorMessage } from '@/lib/admin/error-messages'
import { isAdminRole } from '@/lib/roles'
import { button, errorBox, input } from './styles'

/**
 * 관리자 로그인(이메일·비밀번호). 비밀번호 확인은 Payload 내장 로그인(/api/users/login)이
 * 한다 — 5회 실패 시 10분 잠금도 거기서 걸린다. 관리자가 아닌 계정이면 세션을 즉시 끊는다.
 * 여기서 role 을 보는 건 안내용일 뿐이다 — /manage 게이트는 서버가 매 요청 다시 판정한다.
 */
export function AdminLoginForm() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (busy) return
    setBusy(true)
    setError(null)
    try {
      const login = await fetch('/api/users/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim(), password }),
      })
      if (!login.ok) {
        // 없는 계정·틀린 비밀번호·잠김을 구분해 보여주지 않는다
        setError(adminErrorMessage('login_failed'))
        return
      }
      const body = await login.json().catch(() => ({}))
      if (!isAdminRole(body?.user?.role)) {
        // 고객 계정 세션을 /manage 에 남겨 두지 않는다
        await fetch('/api/users/logout', { method: 'POST' }).catch(() => {})
        setError(adminErrorMessage('login_failed'))
        return
      }
      router.push('/manage')
      router.refresh()
    } catch {
      setError(adminErrorMessage('network'))
    } finally {
      setBusy(false)
    }
  }

  return (
    <form onSubmit={submit} style={{ display: 'grid', gap: 12, maxWidth: 320 }}>
      <label style={{ fontSize: 13 }}>
        이메일
        <input
          style={{ ...input, display: 'block', width: '100%', marginTop: 4 }}
          type="email"
          autoComplete="username"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          disabled={busy}
        />
      </label>
      <label style={{ fontSize: 13 }}>
        비밀번호
        <input
          style={{ ...input, display: 'block', width: '100%', marginTop: 4 }}
          type="password"
          autoComplete="current-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          disabled={busy}
        />
      </label>
      <button type="submit" style={button} disabled={busy}>
        {busy ? '확인 중…' : '로그인'}
      </button>
      {error ? <p style={errorBox}>{error}</p> : null}
    </form>
  )
}
