'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { passwordIssue, PASSWORD_MAX } from '@/lib/password-policy'
import s from './Auth.module.css'

export type InviteLabels = Record<
  'email' | 'role' | 'name' | 'namePh' | 'phone' | 'phonePh' | 'password' | 'passwordHint' | 'passwordConfirm' | 'passwordConfirmPh' | 'submit' | 'submitting',
  string
> & { errors: Record<string, string> }

type Form = { name: string; phone: string; password: string; passwordConfirm: string }
type Key = keyof Form

function validate(f: Form): Partial<Record<Key, string>> {
  const e: Partial<Record<Key, string>> = {}
  for (const k of ['name', 'phone', 'password', 'passwordConfirm'] as const) if (!f[k].trim()) e[k] = 'required'
  if (!e.password && passwordIssue(f.password)) e.password = 'weak_password'
  if (!e.passwordConfirm && f.password !== f.passwordConfirm) e.passwordConfirm = 'password_mismatch'
  return e
}

/** 관리자 초대 수락 양식. 끝나면 로그인 화면으로 보낸다(로그인 후 관리자 화면) */
export function InviteForm({ locale, token, email, roleLabel, labels }: { locale: string; token: string; email: string; roleLabel: string; labels: InviteLabels }) {
  const router = useRouter()
  const [f, setF] = useState<Form>({ name: '', phone: '', password: '', passwordConfirm: '' })
  const [fieldErr, setFieldErr] = useState<Partial<Record<Key, string>>>({})
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const msg = (code: string) => labels.errors[code] ?? labels.errors.generic ?? ''

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (busy) return
    const fe = validate(f)
    setFieldErr(fe)
    setError(null)
    if (Object.keys(fe).length) return
    setBusy(true)
    try {
      const res = await fetch('/api/invite/accept', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ token, ...f }) })
      const body = await res.json().catch(() => ({}))
      if (!res.ok || !body?.ok) {
        if (body?.error === 'weak_password') return setFieldErr({ password: 'weak_password' })
        if (body?.error === 'password_mismatch') return setFieldErr({ passwordConfirm: 'password_mismatch' })
        return setError(msg(body?.error ?? 'generic'))
      }
      router.push(`/${locale}/login?next=/manage`)
    } catch {
      setError(msg('network'))
    } finally {
      setBusy(false)
    }
  }

  const field = (key: Key, attrs: React.InputHTMLAttributes<HTMLInputElement>, help?: string) => {
    const id = `iv-${key}`
    const err = fieldErr[key]
    return (
      <div className={err ? `${s.field} ${s.invalid}` : s.field}>
        <label htmlFor={id} className={s.label}>
          {labels[key]} *
        </label>
        <input
          id={id}
          className={s.input}
          value={f[key]}
          onChange={(e) => setF({ ...f, [key]: e.target.value })}
          disabled={busy}
          aria-invalid={err ? true : undefined}
          aria-describedby={[help ? `${id}-help` : '', err ? `${id}-err` : ''].filter(Boolean).join(' ') || undefined}
          {...attrs}
        />
        {help ? (
          <p id={`${id}-help`} className={s.help}>
            {help}
          </p>
        ) : null}
        {err ? (
          <p id={`${id}-err`} className={s.fieldError}>
            <img src="/ui/alert-sm.svg" alt="" width={14} height={14} />
            {msg(err)}
          </p>
        ) : null}
      </div>
    )
  }

  return (
    <form className={s.card} onSubmit={submit} noValidate>
      <div className={s.field}>
        <label htmlFor="iv-email" className={s.label}>
          {labels.email}
        </label>
        <input id="iv-email" className={s.input} value={email} readOnly />
      </div>
      <div className={s.field}>
        <span className={s.label}>{labels.role}</span>
        <p className={s.info}>{roleLabel}</p>
      </div>
      {field('name', { placeholder: labels.namePh, autoComplete: 'name' })}
      {field('phone', { placeholder: labels.phonePh, autoComplete: 'tel', inputMode: 'tel' })}
      {field('password', { type: 'password', autoComplete: 'new-password', maxLength: PASSWORD_MAX }, labels.passwordHint)}
      {field('passwordConfirm', { type: 'password', autoComplete: 'new-password', placeholder: labels.passwordConfirmPh, maxLength: PASSWORD_MAX })}
      {error ? (
        <p className={s.banner} role="alert">
          <img src="/ui/alert-sm.svg" alt="" width={18} height={18} />
          {error}
        </p>
      ) : null}
      <button type="submit" className={`btn btn-primary btn-block ${s.primary}`} disabled={busy}>
        {busy ? labels.submitting : labels.submit}
      </button>
    </form>
  )
}
