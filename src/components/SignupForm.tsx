'use client'

import { useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { passwordIssue, PASSWORD_MAX, PASSWORD_MIN } from '@/lib/password-policy'
import { focusFirstInvalid } from '@/lib/ui/focus-invalid'
import { AddressSearch } from './AddressSearch'
import { LegalConsentModal, type LegalKind } from './LegalConsentModal'
import s from './Auth.module.css'

export type SignupLabels = Record<
  | 'accountTitle' | 'ordererTitle' | 'ordererHint' | 'consentTitle'
  | 'email' | 'emailPh' | 'emailHelp' | 'password' | 'passwordHint' | 'passwordConfirm' | 'passwordConfirmPh'
  | 'name' | 'namePh' | 'phone' | 'phonePh' | 'postalCode' | 'postalCodePh' | 'address1' | 'address1Ph' | 'address2' | 'address2Ph'
  | 'businessNo' | 'businessNoPh' | 'addressSearch'
  | 'agreeAll' | 'agreeAge' | 'agreeTerms' | 'agreePrivacy' | 'agreeMarketing' | 'view' | 'submit' | 'submitting',
  string
> & { errors: Record<string, string> }

type Form = { email: string; password: string; passwordConfirm: string; name: string; phone: string; postalCode: string; address1: string; address2: string; businessNo: string }
type Consents = { age: boolean; terms: boolean; privacy: boolean; marketing: boolean }
const REQUIRED: (keyof Form)[] = ['email', 'password', 'passwordConfirm', 'name', 'phone', 'postalCode', 'address1']

/** 칸별 오류 코드. 서버도 같은 규칙(password-policy)으로 다시 본다 */
function validate(f: Form): Partial<Record<keyof Form, string>> {
  const e: Partial<Record<keyof Form, string>> = {}
  for (const k of REQUIRED) if (!f[k].trim()) e[k] = 'required'
  if (!e.email && !/^\S+@\S+\.\S+$/.test(f.email.trim())) e.email = 'email'
  if (!e.password && passwordIssue(f.password)) e.password = 'weak_password'
  if (!e.passwordConfirm && f.password !== f.passwordConfirm) e.passwordConfirm = 'password_mismatch'
  return e
}

/**
 * 회원가입(Figma [v2] 08b). role 필드는 두지도 보내지도 않는다(요구사항 1-16 규칙 1).
 * 가입이 되면 바로 로그인해 마이페이지로 보낸다.
 */
export function SignupForm({ locale, labels }: { locale: string; labels: SignupLabels }) {
  const router = useRouter()
  const [f, setF] = useState<Form>({ email: '', password: '', passwordConfirm: '', name: '', phone: '', postalCode: '', address1: '', address2: '', businessNo: '' })
  const [c, setC] = useState<Consents>({ age: false, terms: false, privacy: false, marketing: false })
  const [fieldErr, setFieldErr] = useState<Partial<Record<keyof Form, string>>>({})
  const [busy, setBusy] = useState(false)
  const [viewing, setViewing] = useState<LegalKind | null>(null)
  const [error, setError] = useState<string | null>(null)
  const formRef = useRef<HTMLFormElement>(null)
  const msg = (code: string) => labels.errors[code] ?? labels.errors.generic ?? ''
  const allOn = c.age && c.terms && c.privacy && c.marketing

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (busy) return
    const fe = validate(f)
    setFieldErr(fe)
    if (Object.keys(fe).length) {
      focusFirstInvalid(formRef.current)
      return setError(null)
    }
    if (!c.age || !c.terms || !c.privacy) {
      // 빠진 필수 동의 체크박스로 이동한다
      focusFirstInvalid(formRef.current, [!c.age && '#su-agree-age', !c.terms && '#su-agree-terms', !c.privacy && '#su-agree-privacy'].filter(Boolean).join(', '))
      return setError(msg('consent_required'))
    }
    setBusy(true)
    setError(null)
    try {
      const { passwordConfirm: _, ...rest } = f
      const res = await fetch('/api/signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...rest, agreeAge: c.age, agreeTerms: c.terms, agreePrivacy: c.privacy, agreeMarketing: c.marketing }),
      })
      const body = await res.json().catch(() => ({}))
      if (!res.ok || !body?.ok) {
        if (body?.error === 'weak_password') {
          focusFirstInvalid(formRef.current)
          return setFieldErr({ password: 'weak_password' })
        }
        return setError(msg(body?.error ?? 'generic'))
      }
      const login = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: f.email.trim(), password: f.password }),
      })
      router.push(login.ok ? `/${locale}/mypage` : `/${locale}/login`)
      router.refresh()
    } catch {
      setError(msg('network'))
    } finally {
      setBusy(false)
    }
  }

  const field = (key: keyof Form, opts: { required?: boolean; help?: string; ph?: string; label?: string } & React.InputHTMLAttributes<HTMLInputElement> = {}) => {
    const { required = REQUIRED.includes(key), help, ph, label, ...attrs } = opts
    const id = `su-${key}`
    const err = fieldErr[key]
    const describedBy = [help ? `${id}-help` : '', err ? `${id}-err` : ''].filter(Boolean).join(' ') || undefined
    return (
      <div className={err ? `${s.field} ${s.invalid}` : s.field}>
        <label htmlFor={id} className={s.label}>
          {label ?? labels[key as keyof SignupLabels as Exclude<keyof SignupLabels, 'errors'>]}
          {required ? ' *' : ''}
        </label>
        <div className={s.inline}>
          <input
            id={id}
            className={s.input}
            placeholder={ph}
            value={f[key]}
            onChange={(e) => setF({ ...f, [key]: e.target.value })}
            disabled={busy}
            aria-invalid={err ? true : undefined}
            aria-describedby={describedBy}
            {...attrs}
          />
          {key === 'postalCode' ? (
            <AddressSearch
              locale={locale}
              className={`btn btn-secondary ${s.searchBtn}`}
              disabled={busy}
              labels={{ button: labels.addressSearch }}
              focusId="su-address2"
              onSelect={(p) => setF((prev) => ({ ...prev, ...p }))}
            />
          ) : null}
        </div>
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

  const consent = (key: keyof Consents, text: string, href?: string) => (
    <div className={`choice ${s.consent}`}>
      <label className={s.consentText} style={{ display: 'flex', alignItems: 'center', gap: 12, cursor: 'pointer' }}>
        <input id={`su-agree-${key}`} type="checkbox" checked={c[key]} onChange={(e) => setC({ ...c, [key]: e.target.checked })} disabled={busy} />
        <span className="choice-box" aria-hidden />
        <span>{text}</span>
      </label>
      {/* 동의 전에 원문을 볼 수 있어야 한다. 모달(v2 13-A) — 입력 중인 가입 양식이 날아가지 않게. 링크는 JS 없을 때의 대비 */}
      {href ? (
        <a
          href={href}
          target="_blank"
          rel="noopener"
          className={s.view}
          onClick={(e) => {
            if (key !== 'terms' && key !== 'privacy') return
            e.preventDefault()
            setViewing(key)
          }}
        >
          {labels.view}
        </a>
      ) : null}
    </div>
  )

  return (
    <form ref={formRef} onSubmit={submit} noValidate style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <section className={s.card} aria-labelledby="su-account">
        <h2 id="su-account" className={s.cardTitle}>
          {labels.accountTitle}
        </h2>
        {field('email', { type: 'email', autoComplete: 'email', maxLength: 200, ph: labels.emailPh, help: labels.emailHelp })}
        {field('password', { type: 'password', autoComplete: 'new-password', minLength: PASSWORD_MIN, maxLength: PASSWORD_MAX, ph: labels.passwordHint, help: labels.passwordHint })}
        {field('passwordConfirm', { type: 'password', autoComplete: 'new-password', maxLength: PASSWORD_MAX, ph: labels.passwordConfirmPh, label: labels.passwordConfirm })}
      </section>

      <section className={s.card} aria-labelledby="su-orderer">
        <h2 id="su-orderer" className={s.cardTitle}>
          {labels.ordererTitle}
        </h2>
        <p className={s.cardHint}>{labels.ordererHint}</p>
        <div className={s.row}>
          {field('name', { autoComplete: 'name', maxLength: 100, ph: labels.namePh })}
          {field('phone', { autoComplete: 'tel', inputMode: 'tel', maxLength: 40, ph: labels.phonePh })}
        </div>
        <div className={s.row}>
          {field('postalCode', { autoComplete: 'postal-code', maxLength: 20, ph: labels.postalCodePh })}
          {field('address1', { autoComplete: 'address-line1', maxLength: 200, ph: labels.address1Ph })}
        </div>
        {field('address2', { autoComplete: 'address-line2', maxLength: 200, ph: labels.address2Ph })}
        {field('businessNo', { maxLength: 20, ph: labels.businessNoPh })}
      </section>

      <section className={s.card} aria-labelledby="su-consent">
        <h2 id="su-consent" className={s.cardTitle}>
          {labels.consentTitle}
        </h2>
        <label className={`choice ${s.consent} ${s.consentAll}`}>
          <input
            type="checkbox"
            checked={allOn}
            onChange={() => {
              const v = !allOn
              setC({ age: v, terms: v, privacy: v, marketing: v })
            }}
            disabled={busy}
          />
          <span className="choice-box" aria-hidden />
          <span className={s.consentText}>{labels.agreeAll}</span>
        </label>
        {consent('age', labels.agreeAge)}
        {consent('terms', labels.agreeTerms, `/${locale}/terms`)}
        {consent('privacy', labels.agreePrivacy, `/${locale}/privacy`)}
        {consent('marketing', labels.agreeMarketing)}
      </section>
      <LegalConsentModal kind={viewing} locale={locale} onClose={() => setViewing(null)} onAgree={(k) => k !== 'refund' && setC((prev) => ({ ...prev, [k]: true }))} />

      {error ? (
        <p role="alert" className={s.banner}>
          <img src="/ui/alert.svg" alt="" width={18} height={18} />
          {error}
        </p>
      ) : null}
      <button type="submit" disabled={busy} className={`btn btn-primary btn-block ${s.primary}`}>
        {busy ? labels.submitting : labels.submit}
      </button>
    </form>
  )
}
