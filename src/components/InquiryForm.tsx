'use client'

import { useState } from 'react'
import { ChoiceCard, ChoiceGrid, StepTitle } from '@/components/ui'
import { LegalConsentModal } from './LegalConsentModal'
import s from './InquiryQuote.module.css'

type Labels = {
  countryTitle: string
  countries: { kr: string; jp: string }
  bodyTitle: string
  bodyLabel: string
  bodyPlaceholder: string
  regionLabel: string
  regionPlaceholder: string
  filesDrop: string
  filesButton: string
  filesHint: string
  contactTitle: string
  contactHint: string
  name: string
  namePlaceholder: string
  phone: string
  phonePlaceholder: string
  email: string
  emailPlaceholder: string
  consent: string
  consentView: string
  notice: string
  submit: string
  submitting: string
  done: string
  errors: Record<string, string>
}

type Props = {
  locale: string
  /** ?type= 로 넘어와 서버가 카테고리 표와 대조를 끝낸 값. 화면에는 없고 그대로 함께 보낸다 */
  initialType: string | null
  initialContact?: { name?: string; phone?: string; email?: string }
  labels: Labels
}

// 서버 상한과 같은 값(src/app/(frontend)/api/inquiry/route.ts). 여기서는 미리 알려주는 용도다
const MAX_FILES = 5
const MAX_TOTAL_BYTES = 4 * 1024 * 1024
const COUNTRIES = ['kr', 'jp'] as const

/**
 * 5번 기타 문의 폼(v2 219:435). 금액이 없다 — 문의를 받은 담당자가 견적을 발행한다(Q14-B).
 * 개인정보 동의는 서버도 확인한다(consent_required).
 */
export function InquiryForm({ locale, initialType, initialContact, labels }: Props) {
  const [country, setCountry] = useState<string[]>([])
  const [body, setBody] = useState('')
  const [region, setRegion] = useState('')
  const [name, setName] = useState(initialContact?.name ?? '')
  const [phone, setPhone] = useState(initialContact?.phone ?? '')
  const [email, setEmail] = useState(initialContact?.email ?? '')
  const [consent, setConsent] = useState(false)
  const [viewPrivacy, setViewPrivacy] = useState(false)
  const [files, setFiles] = useState<File[]>([])
  const [dragging, setDragging] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [done, setDone] = useState(false)

  const err = (code: string) => labels.errors[code] ?? labels.errors.generic ?? ''
  const toggle = (c: string) => setCountry((cur) => (cur.includes(c) ? cur.filter((x) => x !== c) : [...cur, c]))

  function pickFiles(list: FileList | null) {
    const picked = Array.from(list ?? [])
    if (picked.length > MAX_FILES) return setError(err('too_many_files'))
    if (picked.reduce((sum, f) => sum + f.size, 0) > MAX_TOTAL_BYTES) return setError(err('too_large'))
    setError(null)
    setFiles(picked)
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (busy) return
    if (country.length === 0) return setError(err('country_required'))
    if (!body.trim() || !name.trim() || !phone.trim() || !email.trim()) return setError(err('required'))
    if (!consent) return setError(err('consent_required'))
    setBusy(true)
    setError(null)
    try {
      const fd = new FormData()
      if (initialType) fd.set('type', initialType)
      for (const c of country) fd.append('country', c)
      fd.set('body', body)
      fd.set('region', region)
      fd.set('name', name)
      fd.set('phone', phone)
      fd.set('email', email)
      fd.set('consent', 'on')
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

  if (done) return <p className={s.notice} style={{ marginTop: 32 }}>{labels.done}</p>

  return (
    <form onSubmit={submit} className={s.form} noValidate>
      <section className={s.section}>
        <StepTitle n={1} title={labels.countryTitle} id="inq-country" />
        <ChoiceGrid cols={2} labelledBy="inq-country">
          {COUNTRIES.map((c) => (
            <ChoiceCard key={c} type="checkbox" name="country" checked={country.includes(c)} onChange={() => toggle(c)}>
              {labels.countries[c]}
            </ChoiceCard>
          ))}
        </ChoiceGrid>
      </section>

      <section className={s.section}>
        <StepTitle n={2} title={labels.bodyTitle} />
        <label className={s.field}>
          <span className={s.label}>{labels.bodyLabel} *</span>
          <textarea className={s.textarea} placeholder={labels.bodyPlaceholder} value={body} maxLength={5000} onChange={(e) => setBody(e.target.value)} disabled={busy} required />
        </label>
        <label className={s.field}>
          <span className={s.label}>{labels.regionLabel}</span>
          <input className={s.input} placeholder={labels.regionPlaceholder} value={region} maxLength={200} onChange={(e) => setRegion(e.target.value)} disabled={busy} />
        </label>
        <label
          className={dragging ? `${s.drop} ${s.dropActive}` : s.drop}
          onDragOver={(e) => {
            e.preventDefault()
            setDragging(true)
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={(e) => {
            e.preventDefault()
            setDragging(false)
            if (!busy) pickFiles(e.dataTransfer.files)
          }}
        >
          <img src="/ui/upload.svg" alt="" className={s.dropIcon} width={28} height={28} />
          <span>{labels.filesDrop}</span>
          <span className={s.dropBtn}>{labels.filesButton}</span>
          <input type="file" multiple accept="image/jpeg,image/png,image/webp,application/pdf" onChange={(e) => pickFiles(e.target.files)} disabled={busy} />
          {files.length ? (
            <ul className={s.fileList}>
              {files.map((f) => (
                <li key={f.name + f.size}>{f.name}</li>
              ))}
            </ul>
          ) : null}
          <span className={s.hint}>{labels.filesHint}</span>
        </label>
      </section>

      <section className={s.section}>
        <StepTitle n={3} title={labels.contactTitle} hint={labels.contactHint} />
        <div className={s.cols3}>
          <label className={s.field}>
            <span className={s.label}>{labels.name} *</span>
            <input className={s.input} placeholder={labels.namePlaceholder} value={name} maxLength={100} autoComplete="name" onChange={(e) => setName(e.target.value)} disabled={busy} required />
          </label>
          <label className={s.field}>
            <span className={s.label}>{labels.phone} *</span>
            <input className={s.input} placeholder={labels.phonePlaceholder} value={phone} maxLength={40} autoComplete="tel" inputMode="tel" onChange={(e) => setPhone(e.target.value)} disabled={busy} required />
          </label>
          <label className={s.field}>
            <span className={s.label}>{labels.email} *</span>
            <input className={s.input} type="email" placeholder={labels.emailPlaceholder} value={email} maxLength={200} autoComplete="email" onChange={(e) => setEmail(e.target.value)} disabled={busy} required />
          </label>
        </div>
        <label className={s.check}>
          <input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} disabled={busy} required />
          <span className={s.checkBox} aria-hidden />
          <span className={s.checkText}>{labels.consent}</span>
          <a
            className={s.viewLink}
            href={`/${locale}/privacy`}
            target="_blank"
            rel="noopener noreferrer"
            onClick={(e) => {
              e.preventDefault()
              setViewPrivacy(true)
            }}
          >
            {labels.consentView}
          </a>
        </label>
        <LegalConsentModal kind={viewPrivacy ? 'privacy' : null} locale={locale} onClose={() => setViewPrivacy(false)} onAgree={() => setConsent(true)} />
      </section>

      <p className={s.notice}>{labels.notice}</p>
      {error ? (
        <p role="alert" className={s.error}>
          {error}
        </p>
      ) : null}
      <button type="submit" disabled={busy} className={`btn btn-primary btn-block ${s.submit}`}>
        {busy ? labels.submitting : labels.submit}
        <img src="/ui/chevron-white.svg" alt="" className={s.submitIcon} width={22} height={22} />
      </button>
    </form>
  )
}
