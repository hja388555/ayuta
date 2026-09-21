'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { passwordIssue } from '@/lib/password-policy'
import { preloadRecaptcha, recaptchaToken } from '@/lib/recaptcha-client'
import { PasswordInput } from './PasswordInput'
import s from './Auth.module.css'

type Labels = Record<string, string>

/** 비밀번호 찾기 — 이메일을 받아 재설정 링크를 보낸다. 가입 여부와 관계없이 같은 안내를 띄운다 */
export function ForgotPasswordForm({ locale, labels }: { locale: string; labels: Labels }) {
  const [email, setEmail] = useState('')
  const [busy, setBusy] = useState(false)
  const [sent, setSent] = useState(false)
  const [error, setError] = useState<string | null>(null)
  useEffect(preloadRecaptcha, [])

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (busy) return
    setBusy(true)
    setError(null)
    try {
      const res = await fetch('/api/auth/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim(), locale, recaptchaToken: await recaptchaToken('forgot_password') }),
      })
      if (!res.ok) return setError(labels.network ?? '')
      setSent(true)
    } catch {
      setError(labels.network ?? '')
    } finally {
      setBusy(false)
    }
  }

  if (sent) {
    return (
      <div className={s.card}>
        <p role="status" className={s.info}>
          {labels.forgotSent}
        </p>
        <Link href={`/${locale}/login`} className={`btn btn-primary btn-block ${s.primary}`}>
          {labels.backToLogin}
        </Link>
      </div>
    )
  }

  return (
    <form onSubmit={submit} className={s.card}>
      <div className={s.field}>
        <label htmlFor="forgot-email" className={s.label}>
          {labels.email} *
        </label>
        <input
          id="forgot-email"
          className={s.input}
          type="email"
          autoComplete="username"
          placeholder={labels.emailPh}
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          disabled={busy}
        />
      </div>
      {error ? (
        <p role="alert" className={s.banner}>
          {error}
        </p>
      ) : null}
      <button type="submit" disabled={busy} className={`btn btn-primary btn-block ${s.primary}`}>
        {busy ? labels.sending : labels.forgotButton}
      </button>
      <Link href={`/${locale}/login`} className={s.findPw}>
        {labels.backToLogin}
      </Link>
    </form>
  )
}

/** 새 비밀번호 설정 — 메일 링크의 토큰으로 비밀번호를 바꾸고 로그인 화면으로 보낸다 */
export function ResetPasswordForm({ locale, token, labels }: { locale: string; token: string; labels: Labels }) {
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [busy, setBusy] = useState(false)
  const [done, setDone] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [expired, setExpired] = useState(false)

  if (!token) {
    return (
      <div className={s.card}>
        <p role="alert" className={s.banner}>
          {labels.resetNoToken}
        </p>
        <Link href={`/${locale}/forgot-password`} className={`btn btn-primary btn-block ${s.primary}`}>
          {labels.forgotAgain}
        </Link>
      </div>
    )
  }

  if (done) {
    return (
      <div className={s.card}>
        <p role="status" className={s.info}>
          {labels.resetDone}
        </p>
        <Link href={`/${locale}/login`} className={`btn btn-primary btn-block ${s.primary}`}>
          {labels.backToLogin}
        </Link>
      </div>
    )
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (busy) return
    setError(null)
    if (passwordIssue(password)) return setError(labels.resetWeak ?? '')
    if (password !== confirm) return setError(labels.resetMismatch ?? '')
    setBusy(true)
    try {
      const res = await fetch('/api/auth/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, password }),
      })
      if (res.ok) return setDone(true)
      const body = await res.json().catch(() => ({}))
      if (body?.error === 'weak_password') return setError(labels.resetWeak ?? '')
      setExpired(true)
      setError(labels.resetInvalid ?? '')
    } catch {
      setError(labels.network ?? '')
    } finally {
      setBusy(false)
    }
  }

  const pwProps = { className: s.input, autoComplete: 'new-password', maxLength: 128, required: true, disabled: busy, showLabel: labels.showPassword, hideLabel: labels.hidePassword }

  return (
    <form onSubmit={submit} className={s.card}>
      <div className={s.field}>
        <label htmlFor="reset-password" className={s.label}>
          {labels.newPassword} *
        </label>
        <PasswordInput id="reset-password" placeholder={labels.newPasswordPh} value={password} onChange={(e) => setPassword(e.target.value)} {...pwProps} />
      </div>
      <div className={s.field}>
        <label htmlFor="reset-confirm" className={s.label}>
          {labels.confirmPassword} *
        </label>
        <PasswordInput id="reset-confirm" placeholder={labels.confirmPasswordPh} value={confirm} onChange={(e) => setConfirm(e.target.value)} {...pwProps} />
      </div>
      {error ? (
        <p role="alert" className={s.banner}>
          {error}
        </p>
      ) : null}
      {expired ? (
        <Link href={`/${locale}/forgot-password`} className={s.findPw}>
          {labels.forgotAgain}
        </Link>
      ) : null}
      <button type="submit" disabled={busy} className={`btn btn-primary btn-block ${s.primary}`}>
        {busy ? labels.sending : labels.resetButton}
      </button>
    </form>
  )
}
