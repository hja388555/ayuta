'use client'

import { useState } from 'react'

type Labels = {
  typeLabel: string
  typeNone: string
  bodyLabel: string
  bodyPlaceholder: string
  regionLabel: string
  filesLabel: string
  filesHint: string
  contactTitle: string
  name: string
  phone: string
  email: string
  submit: string
  submitting: string
  done: string
  errors: Record<string, string>
}

type Props = {
  locale: string
  types: Array<{ slug: string; label: string }>
  /** ?type= 로 넘어와 서버가 카테고리 표와 대조를 끝낸 값. 없으면 미선택 */
  initialType: string | null
  initialContact?: { name?: string; phone?: string; email?: string }
  labels: Labels
}

// 서버 상한과 같은 값(src/app/(frontend)/api/inquiry/route.ts). 여기서는 미리 알려주는 용도다
const MAX_FILES = 5
const MAX_TOTAL_BYTES = 4 * 1024 * 1024

/**
 * 5번 기타 문의 폼. 금액이 없다 — 문의를 받은 담당자가 견적을 발행한다(Q14-B).
 * 유형 미리 선택은 편의일 뿐, 서버가 제출 시 다시 검증한다(요구사항 1-18).
 */
export function InquiryForm({ locale, types, initialType, initialContact, labels }: Props) {
  const [type, setType] = useState(initialType ?? '')
  const [body, setBody] = useState('')
  const [region, setRegion] = useState('')
  const [name, setName] = useState(initialContact?.name ?? '')
  const [phone, setPhone] = useState(initialContact?.phone ?? '')
  const [email, setEmail] = useState(initialContact?.email ?? '')
  const [files, setFiles] = useState<File[]>([])
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [done, setDone] = useState(false)

  const err = (code: string) => labels.errors[code] ?? labels.errors.generic ?? ''

  function pickFiles(list: FileList | null) {
    const picked = Array.from(list ?? [])
    if (picked.length > MAX_FILES) return setError(err('too_many_files'))
    if (picked.reduce((s, f) => s + f.size, 0) > MAX_TOTAL_BYTES) return setError(err('too_large'))
    setError(null)
    setFiles(picked)
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (busy) return
    if (!body.trim() || !name.trim() || !phone.trim() || !email.trim()) return setError(err('required'))
    setBusy(true)
    setError(null)
    try {
      const fd = new FormData()
      fd.set('type', type)
      fd.set('body', body)
      fd.set('region', region)
      fd.set('name', name)
      fd.set('phone', phone)
      fd.set('email', email)
      fd.set('locale', locale)
      for (const f of files) fd.append('files', f)
      const res = await fetch('/api/inquiry', { method: 'POST', body: fd })
      const json = await res.json().catch(() => ({}))
      if (!res.ok || !json?.ok) return setError(err(json?.error ?? 'generic'))
      setDone(true)
    } catch {
      setError(err('network'))
    } finally {
      setBusy(false)
    }
  }

  if (done) return <p style={{ padding: '24px 0', fontSize: 'var(--fs-body)' }}>{labels.done}</p>

  const field = { display: 'block', width: '100%', marginTop: 6, padding: '10px 12px', border: '1px solid var(--ink-200, #D6D9DE)', borderRadius: 6, fontSize: 'var(--fs-body)', fontFamily: 'inherit' } as const
  const block = { display: 'block', marginTop: 20 } as const

  return (
    <form onSubmit={submit} style={{ marginTop: 24 }}>
      <label style={block}>
        {labels.typeLabel}
        <select style={field} value={type} onChange={(e) => setType(e.target.value)} disabled={busy}>
          <option value="">{labels.typeNone}</option>
          {types.map((t) => (
            <option key={t.slug} value={t.slug}>
              {t.label}
            </option>
          ))}
        </select>
      </label>
      <label style={block}>
        {labels.bodyLabel}
        <textarea style={{ ...field, minHeight: 160 }} placeholder={labels.bodyPlaceholder} value={body} maxLength={5000} onChange={(e) => setBody(e.target.value)} disabled={busy} required />
      </label>
      <label style={block}>
        {labels.regionLabel}
        <input style={field} value={region} maxLength={200} onChange={(e) => setRegion(e.target.value)} disabled={busy} />
      </label>
      <label style={block}>
        {labels.filesLabel}
        <input style={{ ...field, border: 'none', padding: 0 }} type="file" multiple accept="image/jpeg,image/png,image/webp,application/pdf" onChange={(e) => pickFiles(e.target.files)} disabled={busy} />
        <span style={{ fontSize: 'var(--fs-sm)', color: 'var(--ink-500)' }}>{labels.filesHint}</span>
      </label>

      <h2 style={{ fontSize: 'var(--fs-h3, 18px)', marginTop: 32 }}>{labels.contactTitle}</h2>
      <label style={block}>
        {labels.name}
        <input style={field} value={name} maxLength={100} autoComplete="name" onChange={(e) => setName(e.target.value)} disabled={busy} required />
      </label>
      <label style={block}>
        {labels.phone}
        <input style={field} value={phone} maxLength={40} autoComplete="tel" inputMode="tel" onChange={(e) => setPhone(e.target.value)} disabled={busy} required />
      </label>
      <label style={block}>
        {labels.email}
        <input style={field} type="email" value={email} maxLength={200} autoComplete="email" onChange={(e) => setEmail(e.target.value)} disabled={busy} required />
      </label>

      {error ? (
        <p role="alert" style={{ marginTop: 16, color: '#C62828' }}>
          {error}
        </p>
      ) : null}
      <button type="submit" disabled={busy} style={{ marginTop: 24, width: '100%', padding: '14px 0', fontSize: 'var(--fs-body)' }}>
        {busy ? labels.submitting : labels.submit}
      </button>
    </form>
  )
}
