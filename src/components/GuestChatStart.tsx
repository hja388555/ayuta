'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useRef, useState } from 'react'
import { validateGuestStart, type GuestStartErrors } from '@/lib/chat/guest-form'
import { focusFirstInvalid } from '@/lib/ui/focus-invalid'
import { LegalConsentModal } from './LegalConsentModal'
import c from './Chat.module.css'
import s from './InquiryQuote.module.css'

export type GuestStartLabels = {
  title: string
  desc: string
  name: string
  namePlaceholder: string
  email: string
  emailPlaceholder: string
  phone: string
  phonePlaceholder: string
  consent: string
  consentView: string
  start: string
  starting: string
  memberHint: string
  login: string
  linkInvalid: string
  errors: Record<string, string>
}

/**
 * 비회원 채팅 시작 폼(Figma [v2] 12-B 285:2 PC). 서버가 방을 만들고 httpOnly 쿠키를 심으면
 * 화면을 새로 그려(router.refresh) 같은 주소에서 대화방이 열린다. 동의·형식은 서버가 다시 확인한다.
 * 칸별 오류는 한 번에 모두 보여 주고, 첫 번째 잘못된 칸으로 포커스를 옮긴다.
 */
export function GuestChatStart({ locale, linkInvalid, labels }: { locale: 'ko' | 'ja'; linkInvalid: boolean; labels: GuestStartLabels }) {
  const router = useRouter()
  const formRef = useRef<HTMLFormElement>(null)
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [consent, setConsent] = useState(false)
  const [viewPrivacy, setViewPrivacy] = useState(false)
  const [busy, setBusy] = useState(false)
  const [fieldErr, setFieldErr] = useState<GuestStartErrors>({})
  const [error, setError] = useState<string | null>(linkInvalid ? labels.linkInvalid : null)
  const err = (code: string) => labels.errors[code] ?? labels.errors.generic ?? ''

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (busy) return
    const fe = validateGuestStart({ name, email, phone, consent })
    setFieldErr(fe)
    if (Object.keys(fe).length > 0) {
      setError(null)
      return focusFirstInvalid(formRef.current)
    }
    setBusy(true)
    setError(null)
    try {
      const res = await fetch('/api/chat/guest', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, email, phone, consent: true, locale }),
      })
      const json = (await res.json().catch(() => ({}))) as { ok?: boolean; error?: string }
      if (res.status === 409) return router.refresh()
      if (!res.ok || !json.ok) return setError(err(json.error ?? 'generic'))
      router.refresh()
    } catch {
      setError(err('network'))
    } finally {
      setBusy(false)
    }
  }

  // 칸을 고치면 그 칸의 오류만 지운다
  const clear = (k: keyof GuestStartErrors) => fieldErr[k] && setFieldErr((prev) => ({ ...prev, [k]: undefined }))
  const fieldError = (k: keyof GuestStartErrors) =>
    fieldErr[k] ? (
      <p id={`gc-${k}-err`} className={c.fieldError}>
        {err(fieldErr[k]!)}
      </p>
    ) : null
  const invalid = (k: keyof GuestStartErrors) => (fieldErr[k] ? { 'aria-invalid': true, 'aria-describedby': `gc-${k}-err` } : {})

  const next = encodeURIComponent(`/${locale}/chat`)
  return (
    <section className={`${c.card} ${c.start}`} aria-labelledby="guest-chat-title">
      <form ref={formRef} onSubmit={submit} className={c.startForm} noValidate>
        <h2 id="guest-chat-title" className={c.startTitle}>
          {labels.title}
        </h2>
        <p className={c.startDesc}>{labels.desc}</p>
        <label className={s.field}>
          <span className={s.label}>{labels.name} *</span>
          <input className={s.input} placeholder={labels.namePlaceholder} value={name} maxLength={100} autoComplete="name" onChange={(e) => (setName(e.target.value), clear('name'))} disabled={busy} required {...invalid('name')} />
          {fieldError('name')}
        </label>
        <label className={s.field}>
          <span className={s.label}>{labels.email} *</span>
          <input className={s.input} type="email" placeholder={labels.emailPlaceholder} value={email} maxLength={200} autoComplete="email" onChange={(e) => (setEmail(e.target.value), clear('email'))} disabled={busy} required {...invalid('email')} />
          {fieldError('email')}
        </label>
        <label className={s.field}>
          <span className={s.label}>{labels.phone} *</span>
          <input className={s.input} placeholder={labels.phonePlaceholder} value={phone} maxLength={40} autoComplete="tel" inputMode="tel" onChange={(e) => (setPhone(e.target.value), clear('phone'))} disabled={busy} required {...invalid('phone')} />
          {fieldError('phone')}
        </label>
        <div>
          <label className={s.check}>
            <input type="checkbox" checked={consent} onChange={(e) => (setConsent(e.target.checked), clear('consent'))} disabled={busy} required {...invalid('consent')} />
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
          {fieldError('consent')}
        </div>
        <LegalConsentModal
          kind={viewPrivacy ? 'privacy' : null}
          locale={locale}
          onClose={() => setViewPrivacy(false)}
          onAgree={() => {
            setConsent(true)
            clear('consent')
          }}
        />
        {error ? (
          <p role="alert" className={s.error}>
            {error}
          </p>
        ) : null}
        <button type="submit" disabled={busy} className={`btn btn-primary btn-block ${c.startSubmit}`}>
          {busy ? labels.starting : labels.start}
        </button>
        <p className={c.startHint}>
          {labels.memberHint}{' '}
          <Link href={`/${locale}/login?next=${next}`}>{labels.login}</Link>
        </p>
      </form>
    </section>
  )
}
