'use client'

import { useState } from 'react'
import { ChoiceCard, ChoiceGrid, StepTitle } from './ui'
import { defaultPhoneCountry, initialPhoneInput, isValidPhone, type PhoneCountry } from '../lib/phone'
import { LegalConsentModal } from './LegalConsentModal'
import { PhoneInput, phoneForSubmit, usePhoneErrorText } from './PhoneInput'
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
  initialCountry?: readonly string[]
  /** ?type= 로 넘어와 서버가 카테고리 표와 대조를 끝낸 값. 화면에는 없고 그대로 함께 보낸다 */
  initialType: string | null
  initialContact?: { name?: string; phone?: string; email?: string }
  labels: Labels
}

// 서버 상한과 같은 값(src/app/(frontend)/api/inquiry/route.ts). 여기서는 미리 알려주는 용도다
const MAX_FILES = 5
const MAX_TOTAL_BYTES = 4 * 1024 * 1024
const COUNTRIES = ['kr', 'jp'] as const
// 서버는 앞머리 바이트로 다시 판별한다(file-sniff.ts). 여기서는 고르는 순간 안내하는 용도다
const ALLOWED_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp', 'application/pdf'])
const ALLOWED_EXT = /\.(jpe?g|png|webp|pdf)$/i
// 결제 화면(CheckoutForm)과 같은 형식 규칙
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

/** 화면 순서대로 — 첫 오류 칸으로 포커스를 옮길 때 이 순서를 쓴다 */
export const INQUIRY_FIELDS = ['country', 'body', 'files', 'name', 'phone', 'email', 'consent'] as const
export type InquiryField = (typeof INQUIRY_FIELDS)[number]

/** 칸별 오류 코드(messages inquiryForm.errors 키, 연락처 형식은 phone 네임스페이스). 형식의 최종 판정은 서버가 다시 한다 */
export function validateInquiry(v: {
  country: readonly string[]
  body: string
  name: string
  phone: string
  phoneCountry: PhoneCountry
  email: string
  consent: boolean
}): Partial<Record<InquiryField, string>> {
  const errors: Partial<Record<InquiryField, string>> = {}
  if (v.country.length === 0) errors.country = 'country_required'
  if (!v.body.trim()) errors.body = 'field_required'
  if (!v.name.trim()) errors.name = 'field_required'
  if (!v.phone.trim()) errors.phone = 'field_required'
  else if (!isValidPhone(v.phone, v.phoneCountry)) errors.phone = 'phone'
  if (!v.email.trim()) errors.email = 'field_required'
  else if (!EMAIL_RE.test(v.email.trim())) errors.email = 'email'
  if (!v.consent) errors.consent = 'consent_required'
  return errors
}

/** 첨부 확인 — 개수·합계 크기·형식(JPG/PNG/WEBP/PDF). 문제가 없으면 null */
export function fileError(files: readonly { name: string; type: string; size: number }[]): string | null {
  if (files.length > MAX_FILES) return 'too_many_files'
  if (files.reduce((sum, f) => sum + f.size, 0) > MAX_TOTAL_BYTES) return 'too_large'
  // 브라우저가 형식을 모르면(type 빈 값) 확장자로 본다. 둘 중 하나라도 허용 밖이면 거부한다
  if (files.some((f) => (f.type ? !ALLOWED_TYPES.has(f.type) : false) || !ALLOWED_EXT.test(f.name))) return 'invalid_file'
  return null
}

// 서버가 돌려준 오류 코드가 어느 칸의 문제인지
const SERVER_ERROR_FIELD: Partial<Record<string, InquiryField>> = {
  consent_required: 'consent',
  invalid_file: 'files',
  too_large: 'files',
  too_many_files: 'files',
  invalid_phone: 'phone',
}

/**
 * 5번 기타 문의 폼(v2 219:435). 금액이 없다 — 문의를 받은 담당자가 견적을 발행한다(Q14-B).
 * 개인정보 동의는 서버도 확인한다(consent_required).
 * 보내기를 눌렀을 때 틀린 칸을 표시하고(aria-invalid · 칸 아래 안내) 첫 칸으로 포커스를 옮긴다.
 */
export function InquiryForm({ locale, initialType, initialContact, initialCountry, labels }: Props) {
  // 표지 1단계에서 고른 광고 국가를 그대로 체크해 둔다(2026-09-12). 여기서 바꿀 수도 있다
  const [country, setCountry] = useState<string[]>(() => (initialCountry ?? []).filter((c) => c === 'kr' || c === 'jp'))
  const [body, setBody] = useState('')
  const [region, setRegion] = useState('')
  const [name, setName] = useState(initialContact?.name ?? '')
  // 연락처 나라: 회원 연락처의 나라 > 표지에서 하나만 고른 광고 국가 > 화면 언어
  const [phoneInit] = useState(() =>
    initialPhoneInput(initialContact?.phone, defaultPhoneCountry({ stored: initialContact?.phone, coverCountries: initialCountry, locale })),
  )
  const [phone, setPhone] = useState(phoneInit.value)
  const [phoneCountry, setPhoneCountry] = useState<PhoneCountry>(phoneInit.country)
  const phoneErrorText = usePhoneErrorText()
  const [email, setEmail] = useState(initialContact?.email ?? '')
  const [consent, setConsent] = useState(false)
  const [viewPrivacy, setViewPrivacy] = useState(false)
  const [files, setFiles] = useState<File[]>([])
  const [dragging, setDragging] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [done, setDone] = useState(false)
  // 한 번 보내기를 누른 뒤에는 입력하는 대로 칸 오류를 다시 계산한다
  const [attempted, setAttempted] = useState(false)
  const [fileCode, setFileCode] = useState<string | null>(null)

  const err = (code: string) => labels.errors[code] ?? labels.errors.generic ?? ''
  const fieldText = (field: InquiryField, code: string) => (field === 'phone' && code === 'phone' ? phoneErrorText(phone, phoneCountry) : err(code))
  const toggle = (c: string) => setCountry((cur) => (cur.includes(c) ? cur.filter((x) => x !== c) : [...cur, c]))

  const fieldErrors: Partial<Record<InquiryField, string>> = {
    ...(attempted ? validateInquiry({ country, body, name, phone, phoneCountry, email, consent }) : {}),
    ...(fileCode ? { files: fileCode } : {}),
  }

  function pickFiles(list: FileList | null) {
    const picked = Array.from(list ?? [])
    const code = fileError(picked)
    setFileCode(code)
    if (code) return setError(err(code))
    setError(null)
    setFiles(picked)
  }

  function focusField(field: InquiryField) {
    const el =
      field === 'country'
        ? document.querySelector<HTMLInputElement>('#inq-country-grid input')
        : document.getElementById(`inq-${field}`)
    el?.focus()
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (busy) return
    setAttempted(true)
    const errors = { ...validateInquiry({ country, body, name, phone, phoneCountry, email, consent }), ...(fileCode ? { files: fileCode } : {}) }
    const first = INQUIRY_FIELDS.find((f) => errors[f])
    if (first) {
      const count = Object.keys(errors).length
      setError(count > 1 && labels.errors.summary ? labels.errors.summary.replace('{count}', String(count)) : fieldText(first, errors[first]!))
      focusField(first)
      return
    }
    setBusy(true)
    setError(null)
    try {
      const fd = new FormData()
      if (initialType) fd.set('type', initialType)
      for (const c of country) fd.append('country', c)
      fd.set('body', body)
      fd.set('region', region)
      fd.set('name', name)
      fd.set('phone', phoneForSubmit(phone, phoneCountry))
      fd.set('email', email)
      fd.set('consent', 'on')
      fd.set('locale', locale)
      for (const f of files) fd.append('files', f)
      const res = await fetch('/api/inquiry', { method: 'POST', body: fd })
      const json = await res.json().catch(() => ({}))
      if (!res.ok || !json?.ok) {
        const code = typeof json?.error === 'string' ? json.error : 'generic'
        setError(err(code))
        // 서버가 칸을 알 수 있는 사유로 거절했으면 그 칸도 표시한다
        const field = SERVER_ERROR_FIELD[code]
        if (field === 'files') setFileCode(code)
        if (field) focusField(field)
        return
      }
      setDone(true)
    } catch {
      setError(err('network'))
    } finally {
      setBusy(false)
    }
  }

  // 칸 아래 안내문과 aria 속성
  const invalid = (field: InquiryField) => (fieldErrors[field] ? { 'aria-invalid': true as const, 'aria-describedby': `inq-${field}-err` } : {})
  const message = (field: InquiryField) =>
    fieldErrors[field] ? (
      <span id={`inq-${field}-err`} className={s.fieldError}>
        {fieldText(field, fieldErrors[field]!)}
      </span>
    ) : null
  const cls = (base: string | undefined, field: InquiryField) => (fieldErrors[field] ? `${base} ${s.invalid}` : base)

  if (done) return <p className={s.notice} style={{ marginTop: 32 }}>{labels.done}</p>

  return (
    <form onSubmit={submit} className={s.form} noValidate>
      <section className={s.section}>
        <StepTitle n={1} title={labels.countryTitle} id="inq-country" />
        <div id="inq-country-grid">
          <ChoiceGrid cols={2} labelledBy="inq-country">
            {COUNTRIES.map((c) => (
              <ChoiceCard key={c} type="checkbox" name="country" checked={country.includes(c)} onChange={() => toggle(c)}>
                {labels.countries[c]}
              </ChoiceCard>
            ))}
          </ChoiceGrid>
        </div>
        {message('country')}
      </section>

      <section className={s.section}>
        <StepTitle n={2} title={labels.bodyTitle} />
        <label className={cls(s.field, 'body')}>
          <span className={s.label}>{labels.bodyLabel} *</span>
          <textarea id="inq-body" className={s.textarea} placeholder={labels.bodyPlaceholder} value={body} maxLength={5000} onChange={(e) => setBody(e.target.value)} disabled={busy} required {...invalid('body')} />
          {message('body')}
        </label>
        <label className={s.field}>
          <span className={s.label}>{labels.regionLabel}</span>
          <input className={s.input} placeholder={labels.regionPlaceholder} value={region} maxLength={200} onChange={(e) => setRegion(e.target.value)} disabled={busy} />
        </label>
        <label
          className={cls(dragging ? `${s.drop} ${s.dropActive}` : s.drop, 'files')}
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
          <input id="inq-files" type="file" multiple accept="image/jpeg,image/png,image/webp,application/pdf" onChange={(e) => pickFiles(e.target.files)} disabled={busy} {...invalid('files')} />
          {files.length ? (
            <ul className={s.fileList}>
              {files.map((f) => (
                <li key={f.name + f.size}>{f.name}</li>
              ))}
            </ul>
          ) : null}
          <span className={s.hint}>{labels.filesHint}</span>
          {message('files')}
        </label>
      </section>

      <section className={s.section}>
        <StepTitle n={3} title={labels.contactTitle} hint={labels.contactHint} />
        <div className={s.cols3}>
          <label className={cls(s.field, 'name')}>
            <span className={s.label}>{labels.name} *</span>
            <input id="inq-name" className={s.input} placeholder={labels.namePlaceholder} value={name} maxLength={100} autoComplete="name" onChange={(e) => setName(e.target.value)} disabled={busy} required {...invalid('name')} />
            {message('name')}
          </label>
          {/* 나라 select 와 번호 칸이 함께 있어 label 로 감싸지 않는다 — 감싸면 라벨이 select 를 가리킨다 */}
          <div className={s.field}>
            <label htmlFor="inq-phone" className={s.label}>
              {labels.phone} *
            </label>
            <PhoneInput
              id="inq-phone"
              country={phoneCountry}
              value={phone}
              disabled={busy}
              required
              invalid={Boolean(fieldErrors.phone)}
              describedBy={fieldErrors.phone ? 'inq-phone-err' : undefined}
              onChange={(next) => {
                setPhone(next.value)
                setPhoneCountry(next.country)
              }}
            />
            {message('phone')}
          </div>
          <label className={cls(s.field, 'email')}>
            <span className={s.label}>{labels.email} *</span>
            <input id="inq-email" className={s.input} type="email" placeholder={labels.emailPlaceholder} value={email} maxLength={200} autoComplete="email" onChange={(e) => setEmail(e.target.value)} disabled={busy} required {...invalid('email')} />
            {message('email')}
          </label>
        </div>
        <label className={cls(s.check, 'consent')}>
          <input id="inq-consent" type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} disabled={busy} required {...invalid('consent')} />
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
        {message('consent')}
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
