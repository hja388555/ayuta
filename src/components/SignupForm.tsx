'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

type Labels = Record<
  | 'email'
  | 'password'
  | 'passwordHint'
  | 'name'
  | 'phone'
  | 'postalCode'
  | 'address1'
  | 'address2'
  | 'agreeTerms'
  | 'agreePrivacy'
  | 'view'
  | 'submit'
  | 'submitting',
  string
> & { errors: Record<string, string> }

/**
 * 회원가입. role 필드는 두지도 보내지도 않는다(요구사항 1-16 규칙 1).
 * 가입이 되면 바로 로그인해 마이페이지로 보낸다.
 */
export function SignupForm({ locale, labels }: { locale: string; labels: Labels }) {
  const router = useRouter()
  const [f, setF] = useState({ email: '', password: '', name: '', phone: '', postalCode: '', address1: '', address2: '' })
  const [agreeTerms, setAgreeTerms] = useState(false)
  const [agreePrivacy, setAgreePrivacy] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const err = (code: string) => labels.errors[code] ?? labels.errors.generic ?? ''
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement>) => setF({ ...f, [k]: e.target.value })

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (busy) return
    if (!agreeTerms || !agreePrivacy) return setError(err('consent_required'))
    if (f.password.length < 8) return setError(err('password_short'))
    setBusy(true)
    setError(null)
    try {
      const res = await fetch('/api/signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...f, agreeTerms, agreePrivacy }),
      })
      const body = await res.json().catch(() => ({}))
      if (!res.ok || !body?.ok) return setError(err(body?.error ?? 'generic'))
      const login = await fetch('/api/users/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: f.email.trim(), password: f.password }),
      })
      router.push(login.ok ? `/${locale}/mypage` : `/${locale}/login`)
      router.refresh()
    } catch {
      setError(err('network'))
    } finally {
      setBusy(false)
    }
  }

  const field = { display: 'block', width: '100%', marginTop: 6, padding: '10px 12px', border: '1px solid var(--ink-200, #D6D9DE)', borderRadius: 6, fontSize: 'var(--fs-body)', fontFamily: 'inherit' } as const
  return (
    <form onSubmit={submit} style={{ display: 'grid', gap: 16 }}>
      <label>
        {labels.email}
        <input style={field} type="email" autoComplete="email" value={f.email} onChange={set('email')} required disabled={busy} maxLength={200} />
      </label>
      <label>
        {labels.password}
        <input style={field} type="password" autoComplete="new-password" value={f.password} onChange={set('password')} required disabled={busy} minLength={8} maxLength={128} />
        <span style={{ fontSize: 'var(--fs-sm)', color: 'var(--ink-500)' }}>{labels.passwordHint}</span>
      </label>
      <label>
        {labels.name}
        <input style={field} autoComplete="name" value={f.name} onChange={set('name')} required disabled={busy} maxLength={100} />
      </label>
      <label>
        {labels.phone}
        <input style={field} autoComplete="tel" inputMode="tel" value={f.phone} onChange={set('phone')} required disabled={busy} maxLength={40} />
      </label>
      <label>
        {labels.postalCode}
        <input style={field} autoComplete="postal-code" value={f.postalCode} onChange={set('postalCode')} required disabled={busy} maxLength={20} />
      </label>
      <label>
        {labels.address1}
        <input style={field} autoComplete="address-line1" value={f.address1} onChange={set('address1')} required disabled={busy} maxLength={200} />
      </label>
      <label>
        {labels.address2}
        <input style={field} autoComplete="address-line2" value={f.address2} onChange={set('address2')} disabled={busy} maxLength={200} />
      </label>
      <label style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
        <input type="checkbox" checked={agreeTerms} onChange={(e) => setAgreeTerms(e.target.checked)} disabled={busy} /> {labels.agreeTerms}
        {/* 동의 전에 원문을 볼 수 있어야 한다. 새 탭 — 입력 중인 가입 양식이 날아가지 않게 */}
        <a href={`/${locale}/terms`} target="_blank" rel="noopener" style={{ marginLeft: 'auto', fontSize: 13 }}>
          {labels.view}
        </a>
      </label>
      <label style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
        <input type="checkbox" checked={agreePrivacy} onChange={(e) => setAgreePrivacy(e.target.checked)} disabled={busy} /> {labels.agreePrivacy}
        <a href={`/${locale}/privacy`} target="_blank" rel="noopener" style={{ marginLeft: 'auto', fontSize: 13 }}>
          {labels.view}
        </a>
      </label>
      {error ? (
        <p role="alert" style={{ margin: 0, color: '#C62828' }}>
          {error}
        </p>
      ) : null}
      <button type="submit" disabled={busy} style={{ padding: '14px 0', fontSize: 'var(--fs-body)' }}>
        {busy ? labels.submitting : labels.submit}
      </button>
    </form>
  )
}
