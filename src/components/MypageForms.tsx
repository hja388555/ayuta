'use client'

import { useState, type ReactNode } from 'react'
import { useRouter } from 'next/navigation'
import { ChoiceCard, Modal, Toast } from '@/components/ui'
import { passwordIssue } from '@/lib/password-policy'
import s from './Account.module.css'

/**
 * 마이페이지 계정 화면(Figma v2 09-D 회원정보 수정 · 09-E 비밀번호 변경 · 09-F 회원 탈퇴).
 * 입력칸 모양·필드 오류 표시는 결제 화면(CheckoutForm)과 같은 규칙을 따른다.
 */
type Dict = Record<string, string>

async function postJson(url: string, body?: unknown): Promise<{ ok: boolean; error?: string }> {
  const res = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: body === undefined ? undefined : JSON.stringify(body) })
  const json = await res.json().catch(() => ({}))
  return res.ok && json?.ok ? { ok: true } : { ok: false, error: json?.error ?? 'generic' }
}

const tx = (d: Dict, k: string): string => d[k] ?? ''
const errorText = (errors: Dict, code?: string) => errors[code ?? 'generic'] ?? errors.generic ?? ''

function Field({ id, label, required, error, addon, children }: { id: string; label: string; required?: boolean; error?: string; addon?: ReactNode; children: ReactNode }) {
  return (
    <div className={error ? `${s.field} ${s.invalid}` : s.field}>
      <label htmlFor={id} className={s.label}>
        {label}
        {required ? ' *' : ''}
      </label>
      <div className={s.inline}>
        <div className={s.control}>
          {children}
          {error ? <img src="/ui/alert-field.svg" alt="" width={18} height={18} className={s.fieldIcon} /> : null}
        </div>
        {addon}
      </div>
      {error ? (
        <p id={`${id}-err`} className={s.fieldError}>
          <img src="/ui/alert-sm.svg" alt="" width={14} height={14} />
          {error}
        </p>
      ) : null}
    </div>
  )
}

type ProfileValues = { name: string; phone: string; postalCode: string; address1: string; address2: string; businessNo: string }
const REQUIRED: (keyof ProfileValues)[] = ['name', 'phone', 'postalCode', 'address1']

/** 09-D 회원정보 수정. 이메일은 바꾸지 않는다(새 주소 인증 메일이 필요, Q28 이후) */
export function ProfileForm({ email = '', initial: init, labels, errors }: { email?: string; initial: Omit<ProfileValues, 'businessNo'> & { businessNo?: string }; labels: Dict; errors: Dict }) {
  const router = useRouter()
  const initial: ProfileValues = { ...init, businessNo: init.businessNo ?? '' }
  const [v, setV] = useState(initial)
  const [attempted, setAttempted] = useState(false)
  const [busy, setBusy] = useState(false)
  const [toast, setToast] = useState<{ ok: boolean; text: string } | null>(null)
  const missing = (k: keyof ProfileValues) => attempted && REQUIRED.includes(k) && !v[k].trim()

  async function save(e: React.FormEvent) {
    e.preventDefault()
    if (busy) return
    setAttempted(true)
    if (REQUIRED.some((k) => !v[k].trim())) return
    setBusy(true)
    try {
      const r = await postJson('/api/me/profile', v)
      setToast(r.ok ? { ok: true, text: tx(labels, 'saved') } : { ok: false, text: errorText(errors, r.error) })
      if (r.ok) router.refresh()
    } catch {
      setToast({ ok: false, text: errorText(errors, 'network') })
    } finally {
      setBusy(false)
    }
  }

  const input = (k: keyof ProfileValues, opts: { required?: boolean; autoComplete?: string; addon?: ReactNode; max?: number } = {}) => {
    const id = `pf-${k}`
    const err = missing(k) ? tx(labels, 'errRequired') : undefined
    return (
      <Field id={id} label={tx(labels, k)} required={opts.required} error={err} addon={opts.addon}>
        <input
          id={id}
          className={s.input}
          value={v[k]}
          placeholder={tx(labels, `${k}Ph`)}
          autoComplete={opts.autoComplete}
          maxLength={opts.max ?? 200}
          required={opts.required}
          disabled={busy}
          aria-invalid={err ? true : undefined}
          aria-describedby={err ? `${id}-err` : undefined}
          onChange={(e) => setV({ ...v, [k]: e.target.value })}
        />
      </Field>
    )
  }

  return (
    <form onSubmit={save} className={s.stack} noValidate>
      <section className={s.card}>
        <h2 className={s.cardTitle}>{tx(labels, 'accountCard')}</h2>
        <div className={s.field}>
          <label htmlFor="pf-email" className={s.label}>
            {tx(labels, 'email')}
          </label>
          <div className={s.control}>
            <input id="pf-email" className={`${s.input} ${s.locked}`} value={email} disabled readOnly aria-describedby="pf-email-lock" />
            <span id="pf-email-lock" className={s.lockNote}>
              {tx(labels, 'emailLocked')}
            </span>
          </div>
        </div>
      </section>

      <section className={s.card}>
        <h2 className={s.cardTitle}>{tx(labels, 'ordererCard')}</h2>
        <p className={s.cardHint}>{tx(labels, 'ordererHint')}</p>
        <div className={s.row2}>
          {input('name', { required: true, autoComplete: 'name', max: 100 })}
          {input('phone', { required: true, autoComplete: 'tel', max: 40 })}
        </div>
        <div className={s.row2}>
          {input('postalCode', {
            required: true,
            autoComplete: 'postal-code',
            max: 20,
            // 주소 검색(우편번호 서비스)은 큐 Q35에서 붙는다 — 그때까지 버튼만 두고 막는다
            addon: (
              <button type="button" className={`btn btn-secondary ${s.searchBtn}`} disabled title={tx(labels, 'addressSearchSoon')}>
                <img src="/ui/search.svg" alt="" width={18} height={18} />
                {tx(labels, 'addressSearch')}
              </button>
            ),
          })}
          {input('address1', { required: true, autoComplete: 'address-line1' })}
        </div>
        {input('address2', { autoComplete: 'address-line2' })}
        {input('businessNo', { max: 20 })}
      </section>

      <div className={s.actions}>
        <button type="submit" className={`btn btn-primary btn-lg ${s.grow2}`} disabled={busy}>
          {tx(labels, 'save')}
        </button>
        <button
          type="button"
          className={`btn btn-outline btn-lg ${s.grow1}`}
          disabled={busy}
          onClick={() => {
            setV(initial)
            setAttempted(false)
          }}
        >
          {tx(labels, 'cancel')}
        </button>
      </div>
      {toast ? <Toast kind={toast.ok ? 'success' : 'error'} message={toast.text} closeLabel={tx(labels, 'close')} onClose={() => setToast(null)} /> : null}
    </form>
  )
}

/** 09-E 비밀번호 변경. 바꾸면 이 기기에서도 로그아웃하고 로그인 화면으로 보낸다(시안 안내 "다시 로그인") */
export function PasswordForm({ locale = 'ko', labels, errors }: { locale?: string; labels: Dict; errors: Dict }) {
  const router = useRouter()
  const [current, setCurrent] = useState('')
  const [next, setNext] = useState('')
  const [confirm, setConfirm] = useState('')
  const [attempted, setAttempted] = useState(false)
  const [busy, setBusy] = useState(false)
  const [done, setDone] = useState(false)
  const [toast, setToast] = useState<{ ok: boolean; text: string } | null>(null)

  const errs = {
    current: attempted && !current ? tx(labels, 'errRequired') : undefined,
    next: attempted ? (!next ? tx(labels, 'errRequired') : passwordIssue(next) ? tx(labels, 'errWeak') : undefined) : undefined,
    confirm: attempted ? (!confirm ? tx(labels, 'errRequired') : confirm !== next ? tx(labels, 'errMismatch') : undefined) : undefined,
  }

  async function save(e: React.FormEvent) {
    e.preventDefault()
    if (busy || done) return
    setAttempted(true)
    if (!current || !next || passwordIssue(next) || confirm !== next) return
    setBusy(true)
    try {
      const r = await postJson('/api/me/password', { currentPassword: current, newPassword: next })
      if (!r.ok) {
        setToast({ ok: false, text: errorText(errors, r.error) })
        return
      }
      setDone(true)
      setToast({ ok: true, text: tx(labels, 'done') })
      await fetch('/api/users/logout', { method: 'POST' }).catch(() => {})
      setTimeout(() => {
        router.replace(`/${locale}/login?next=${encodeURIComponent(`/${locale}/mypage`)}`)
        router.refresh()
      }, 1500)
    } catch {
      setToast({ ok: false, text: errorText(errors, 'network') })
    } finally {
      setBusy(false)
    }
  }

  const pw = (id: string, key: 'current' | 'next' | 'confirm', value: string, set: (v: string) => void, autoComplete: string) => (
    <Field id={id} label={tx(labels, key)} required error={errs[key]}>
      <input
        id={id}
        className={s.input}
        type="password"
        autoComplete={autoComplete}
        placeholder={tx(labels, `${key}Ph`)}
        value={value}
        maxLength={128}
        required
        disabled={busy || done}
        aria-invalid={errs[key] ? true : undefined}
        aria-describedby={errs[key] ? `${id}-err` : undefined}
        onChange={(e) => set(e.target.value)}
      />
    </Field>
  )

  return (
    <form onSubmit={save} className={s.stack} noValidate>
      <section className={s.card}>
        {pw('pw-current', 'current', current, setCurrent, 'current-password')}
        {pw('pw-next', 'next', next, setNext, 'new-password')}
        {pw('pw-confirm', 'confirm', confirm, setConfirm, 'new-password')}
        <ul className={s.note}>
          <li>{tx(labels, 'rule1')}</li>
          <li>{tx(labels, 'rule2')}</li>
          <li>{tx(labels, 'rule3')}</li>
        </ul>
      </section>
      <button type="submit" className="btn btn-primary btn-lg btn-block" disabled={busy || done}>
        {tx(labels, 'submit')}
      </button>
      {toast ? <Toast kind={toast.ok ? 'success' : 'error'} message={toast.text} closeLabel={tx(labels, 'close')} onClose={() => setToast(null)} /> : null}
    </form>
  )
}


const REASONS = ['reason1', 'reason2', 'reason3', 'reason4', 'reason5'] as const

/**
 * 09-F 회원 탈퇴. 진행 중 주문이 있으면 버튼을 막는다(서버도 409 로 막는다).
 * 탈퇴 사유는 화면에서만 고른다 — 저장할 곳(스키마)이 없어 서버로 보내지 않는다.
 */
export function WithdrawForm({ locale, blocked, labels, errors }: { locale: string; blocked: boolean; labels: Dict; errors: Dict }) {
  const router = useRouter()
  const [reasons, setReasons] = useState<string[]>([])
  const [agree, setAgree] = useState(false)
  const [open, setOpen] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function withdraw() {
    if (busy) return
    setBusy(true)
    setError(null)
    try {
      const r = await postJson('/api/me/withdraw')
      if (!r.ok) {
        setOpen(false)
        return setError(errorText(errors, r.error))
      }
      router.push(`/${locale}`)
      router.refresh()
    } catch {
      setOpen(false)
      setError(errorText(errors, 'network'))
    } finally {
      setBusy(false)
    }
  }

  const toggle = (k: string) => setReasons((prev) => (prev.includes(k) ? prev.filter((x) => x !== k) : [...prev, k]))

  return (
    <div className={s.stack}>
      <section className={s.card}>
        <h2 className={s.cardTitle}>{tx(labels, 'effectsTitle')}</h2>
        <ul className={s.effects}>
          <li>
            <strong>{tx(labels, 'effect1Title')}</strong>
            <span>{tx(labels, 'effect1Sub')}</span>
          </li>
          <li>
            <strong>{tx(labels, 'effect2Title')}</strong>
            <span>{tx(labels, 'effect2Sub')}</span>
          </li>
          <li>
            <strong>{tx(labels, 'effect3Title')}</strong>
          </li>
        </ul>
      </section>

      <section className={s.card} aria-labelledby="wd-reasons">
        <h2 id="wd-reasons" className={s.cardTitle}>
          {tx(labels, 'reasonsTitle')}
        </h2>
        <div className={s.reasons}>
          {REASONS.map((k) => (
            <ChoiceCard key={k} type="checkbox" checked={reasons.includes(k)} onChange={() => toggle(k)}>
              {tx(labels, k)}
            </ChoiceCard>
          ))}
        </div>
      </section>

      <label className={s.agree}>
        <input type="checkbox" checked={agree} onChange={(e) => setAgree(e.target.checked)} disabled={blocked} />
        <span className={s.agreeBox} aria-hidden />
        <span>{tx(labels, 'agree')}</span>
      </label>

      {error ? (
        <p role="alert" className={s.banner}>
          <img src="/ui/alert-field.svg" alt="" width={18} height={18} />
          {error}
        </p>
      ) : null}

      <div className={s.actions}>
        <button type="button" className={`btn btn-lg ${s.danger} ${s.grow1}`} disabled={blocked || !agree || busy} onClick={() => setOpen(true)}>
          {tx(labels, 'submit')}
        </button>
        <button type="button" className={`btn btn-outline btn-lg ${s.grow2}`} onClick={() => router.push(`/${locale}/mypage`)}>
          {tx(labels, 'cancel')}
        </button>
      </div>

      <Modal
        open={open}
        onClose={() => !busy && setOpen(false)}
        title={tx(labels, 'confirmTitle')}
        closeLabel={tx(labels, 'close')}
        footer={
          <div className={s.confirmFoot}>
            <button type="button" className={`btn btn-outline btn-lg ${s.grow2}`} onClick={() => setOpen(false)} disabled={busy}>
              {tx(labels, 'confirmCancel')}
            </button>
            <button type="button" className={`btn btn-lg ${s.danger} ${s.grow1}`} onClick={withdraw} disabled={busy}>
              {tx(labels, 'confirmSubmit')}
            </button>
          </div>
        }
      >
        <div className={s.confirm}>
          <span className={s.confirmIcon}>
            <img src="/ui/alert-danger.svg" alt="" width={30} height={30} />
          </span>
          <p className={s.confirmTitle}>{tx(labels, 'confirmTitle')}</p>
          <p className={s.confirmBody}>
            {tx(labels, 'confirmBody1')}
            <br />
            {tx(labels, 'confirmBody2')}
          </p>
        </div>
      </Modal>
    </div>
  )
}
