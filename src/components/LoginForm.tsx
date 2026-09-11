'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { isAdminRole } from '@/lib/roles'
import s from './Auth.module.css'

type Labels = {
  email: string
  emailPh: string
  password: string
  loginButton: string
  loggingIn: string
  loginFailed: string
  network: string
  keepLogin: string
  findPassword: string
  findPasswordSoon: string
}

/**
 * 통합 로그인(요구사항 1-16, Figma [v2] 08 · A0). 고객·관리자가 같은 화면으로 들어온다. 비밀번호 확인과 5회 실패
 * 10분 잠금은 Payload 내장 로그인이 한다. 관리자면 관리자 홈으로, 고객이면 마이페이지로 보낸다 —
 * role 로 가르는 건 이동 편의일 뿐, 관리자 화면 접근은 서버가 매 요청 다시 판정한다(1-16 규칙 3).
 */
export function LoginForm({ locale, next, labels }: { locale: string; next?: string; labels: Labels }) {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  // "로그인 상태 유지": 시안에 있어 그려 두지만 아직 동작하지 않는다. 세션 길이는 Users.auth.tokenExpiration(2시간)
  // 하나로 고정이고, Payload 로그인은 요청마다 만료를 달리 줄 수 없다. 체크해도 서버에 보내지 않는다 —
  // 켜면 오래 유지될 것처럼 보이게 속이지 않도록, 실제 연장(별도 refresh 경로)이 생기면 그때 연결한다.
  const [keep, setKeep] = useState(false)
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

  return (
    <form onSubmit={submit} className={s.card} noValidate={false}>
      <div className={s.field}>
        <label htmlFor="login-email" className={s.label}>
          {labels.email} *
        </label>
        <input id="login-email" className={s.input} type="email" autoComplete="username" placeholder={labels.emailPh} value={email} onChange={(e) => setEmail(e.target.value)} required disabled={busy} />
      </div>
      <div className={s.field}>
        <label htmlFor="login-password" className={s.label}>
          {labels.password} *
        </label>
        <input id="login-password" className={s.input} type="password" autoComplete="current-password" placeholder="••••••••" value={password} onChange={(e) => setPassword(e.target.value)} required disabled={busy} />
      </div>
      <div className={s.keepRow}>
        <label className={s.keep}>
          <input type="checkbox" checked={keep} onChange={(e) => setKeep(e.target.checked)} disabled={busy} />
          <span className={s.box} aria-hidden />
          {labels.keepLogin}
        </label>
        {/* 비밀번호 재설정 메일(큐 Q28)이 아직 없다. 죽은 링크 대신 비활성 버튼 + 안내 title */}
        <button type="button" className={s.findPw} disabled title={labels.findPasswordSoon}>
          {labels.findPassword}
        </button>
      </div>
      {error ? (
        <p role="alert" className={s.banner}>
          <img src="/ui/alert.svg" alt="" width={18} height={18} />
          {error}
        </p>
      ) : null}
      <button type="submit" disabled={busy} className={`btn btn-primary btn-block ${s.primary}`}>
        {busy ? labels.loggingIn : labels.loginButton}
      </button>
    </form>
  )
}
