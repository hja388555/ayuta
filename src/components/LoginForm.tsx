'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { isAdminRole } from '@/lib/roles'

type Labels = { email: string; password: string; loginButton: string; loggingIn: string; loginFailed: string; network: string }

/**
 * 통합 로그인(요구사항 1-16). 고객·관리자가 같은 화면으로 들어온다. 비밀번호 확인과 5회 실패
 * 10분 잠금은 Payload 내장 로그인이 한다. 관리자면 관리자 홈으로, 고객이면 마이페이지로 보낸다 —
 * role 로 가르는 건 이동 편의일 뿐, 관리자 화면 접근은 서버가 매 요청 다시 판정한다(1-16 규칙 3).
 */
export function LoginForm({ locale, next, labels }: { locale: string; next?: string; labels: Labels }) {
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
      const res = await fetch('/api/users/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim(), password }),
      })
      if (!res.ok) {
        // 없는 계정·틀린 비밀번호·잠김을 구분해 보여주지 않는다
        setError(labels.loginFailed)
        return
      }
      const body = await res.json().catch(() => ({}))
      const dest = next ?? (isAdminRole(body?.user?.role) ? '/manage' : `/${locale}/mypage`)
      router.push(dest)
      router.refresh()
    } catch {
      setError(labels.network)
    } finally {
      setBusy(false)
    }
  }

  const field = { display: 'block', width: '100%', marginTop: 6, padding: '10px 12px', border: '1px solid var(--ink-200, #D6D9DE)', borderRadius: 6, fontSize: 'var(--fs-body)', fontFamily: 'inherit' } as const
  return (
    <form onSubmit={submit} style={{ display: 'grid', gap: 16 }}>
      <label>
        {labels.email}
        <input style={field} type="email" autoComplete="username" value={email} onChange={(e) => setEmail(e.target.value)} required disabled={busy} />
      </label>
      <label>
        {labels.password}
        <input style={field} type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} required disabled={busy} />
      </label>
      {error ? (
        <p role="alert" style={{ margin: 0, color: '#C62828' }}>
          {error}
        </p>
      ) : null}
      <button type="submit" disabled={busy} style={{ padding: '14px 0', fontSize: 'var(--fs-body)' }}>
        {busy ? labels.loggingIn : labels.loginButton}
      </button>
    </form>
  )
}
