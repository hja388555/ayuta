'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

type Errors = Record<string, string>
const field = { display: 'block', width: '100%', marginTop: 6, padding: '10px 12px', border: '1px solid var(--ink-200, #D6D9DE)', borderRadius: 6, fontSize: 'var(--fs-body)', fontFamily: 'inherit' } as const

async function postJson(url: string, body?: unknown): Promise<{ ok: boolean; error?: string }> {
  const res = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: body === undefined ? undefined : JSON.stringify(body) })
  const json = await res.json().catch(() => ({}))
  return res.ok && json?.ok ? { ok: true } : { ok: false, error: json?.error ?? 'generic' }
}

type ProfileValues = { name: string; phone: string; postalCode: string; address1: string; address2: string }

/** 정보 수정 — 이름·연락처·주소만. 이메일은 바꾸지 않는다(인증 메일이 필요, Q28 이후) */
export function ProfileForm({ initial, labels, errors }: { initial: ProfileValues; labels: Record<keyof ProfileValues | 'save' | 'saved', string>; errors: Errors }) {
  const router = useRouter()
  const [v, setV] = useState(initial)
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null)

  async function save(e: React.FormEvent) {
    e.preventDefault()
    if (busy) return
    setBusy(true)
    setMsg(null)
    try {
      const r = await postJson('/api/me/profile', v)
      setMsg(r.ok ? { ok: true, text: labels.saved } : { ok: false, text: errors[r.error ?? 'generic'] ?? errors.generic ?? '' })
      if (r.ok) router.refresh()
    } catch {
      setMsg({ ok: false, text: errors.network ?? '' })
    } finally {
      setBusy(false)
    }
  }

  const input = (k: keyof ProfileValues, required = true) => (
    <label>
      {labels[k]}
      <input style={field} value={v[k]} onChange={(e) => setV({ ...v, [k]: e.target.value })} required={required} disabled={busy} maxLength={200} />
    </label>
  )
  return (
    <form onSubmit={save} style={{ display: 'grid', gap: 12 }}>
      {input('name')}
      {input('phone')}
      {input('postalCode')}
      {input('address1')}
      {input('address2', false)}
      <button type="submit" disabled={busy} style={{ padding: '12px 0' }}>
        {labels.save}
      </button>
      {msg ? <p style={{ margin: 0, color: msg.ok ? '#2E7D32' : '#C62828' }}>{msg.text}</p> : null}
    </form>
  )
}

export function PasswordForm({ labels, errors }: { labels: Record<'current' | 'next' | 'hint' | 'save' | 'saved', string>; errors: Errors }) {
  const [current, setCurrent] = useState('')
  const [next, setNext] = useState('')
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null)

  async function save(e: React.FormEvent) {
    e.preventDefault()
    if (busy) return
    if (next.length < 8) return setMsg({ ok: false, text: errors.password_short ?? '' })
    setBusy(true)
    setMsg(null)
    try {
      const r = await postJson('/api/me/password', { currentPassword: current, newPassword: next })
      setMsg(r.ok ? { ok: true, text: labels.saved } : { ok: false, text: errors[r.error ?? 'generic'] ?? errors.generic ?? '' })
      if (r.ok) {
        setCurrent('')
        setNext('')
      }
    } catch {
      setMsg({ ok: false, text: errors.network ?? '' })
    } finally {
      setBusy(false)
    }
  }

  return (
    <form onSubmit={save} style={{ display: 'grid', gap: 12 }}>
      <label>
        {labels.current}
        <input style={field} type="password" autoComplete="current-password" value={current} onChange={(e) => setCurrent(e.target.value)} required disabled={busy} />
      </label>
      <label>
        {labels.next}
        <input style={field} type="password" autoComplete="new-password" value={next} onChange={(e) => setNext(e.target.value)} required disabled={busy} minLength={8} maxLength={128} />
        <span style={{ fontSize: 'var(--fs-sm)', color: 'var(--ink-500)' }}>{labels.hint}</span>
      </label>
      <button type="submit" disabled={busy} style={{ padding: '12px 0' }}>
        {labels.save}
      </button>
      {msg ? <p style={{ margin: 0, color: msg.ok ? '#2E7D32' : '#C62828' }}>{msg.text}</p> : null}
    </form>
  )
}

export function WithdrawButton({ locale, labels, errors }: { locale: string; labels: Record<'button' | 'confirm', string>; errors: Errors }) {
  const router = useRouter()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function withdraw() {
    if (busy || !window.confirm(labels.confirm)) return
    setBusy(true)
    setError(null)
    try {
      const r = await postJson('/api/me/withdraw')
      if (!r.ok) return setError(errors[r.error ?? 'generic'] ?? errors.generic ?? '')
      router.push(`/${locale}`)
      router.refresh()
    } catch {
      setError(errors.network ?? '')
    } finally {
      setBusy(false)
    }
  }
  return (
    <div>
      <button type="button" onClick={withdraw} disabled={busy} style={{ padding: '10px 16px', color: '#C62828' }}>
        {labels.button}
      </button>
      {error ? (
        <p role="alert" style={{ color: '#C62828' }}>
          {error}
        </p>
      ) : null}
    </div>
  )
}
