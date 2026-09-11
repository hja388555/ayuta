'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import s from './Auth.module.css'

type Labels = {
  title: string
  hint: string
  orderNumber: string
  orderNumberPh: string
  email: string
  emailPh: string
  phone: string
  phonePh: string
  lookupButton: string
  lookupFailed: string
  network: string
}

/**
 * 비회원 주문 조회(요구사항 126행 — 로그인 화면 하단, Figma [v2] 08 카드). 주문번호·이메일·연락처 세 가지가 모두
 * 맞아야 열린다. 서버는 어느 값이 틀렸는지, 그 주문번호가 있는지 알려주지 않는다.
 * 맞으면 서버가 짧게 사는 서명 쿠키를 주고, 기존 주문 완료 화면에서 주문을 보여준다.
 */
export function GuestLookupForm({ locale, labels }: { locale: string; labels: Labels }) {
  const router = useRouter()
  const [orderNumber, setOrderNumber] = useState('')
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (busy) return
    setBusy(true)
    setError(null)
    try {
      const res = await fetch('/api/order-lookup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orderNumber: orderNumber.trim(), email: email.trim(), phone: phone.trim(), locale }),
      })
      const body = await res.json().catch(() => ({}))
      if (!res.ok || !body?.ok) {
        setError(labels.lookupFailed)
        return
      }
      router.push(body.path)
    } catch {
      setError(labels.network)
    } finally {
      setBusy(false)
    }
  }

  const input = (id: string, label: string, ph: string, value: string, set: (v: string) => void, extra: React.InputHTMLAttributes<HTMLInputElement>) => (
    <div className={s.field}>
      <label htmlFor={id} className={s.label}>
        {label} *
      </label>
      <input id={id} className={s.input} placeholder={ph} value={value} onChange={(e) => set(e.target.value)} required disabled={busy} {...extra} />
    </div>
  )

  return (
    <form onSubmit={submit} className={s.card} aria-labelledby="guest-title">
      <h2 id="guest-title" className={s.guestTitle}>
        {labels.title}
      </h2>
      <p className={s.cardHint}>{labels.hint}</p>
      {input('guest-order', labels.orderNumber, labels.orderNumberPh, orderNumber, setOrderNumber, { maxLength: 60 })}
      {input('guest-email', labels.email, labels.emailPh, email, setEmail, { type: 'email', maxLength: 200 })}
      {input('guest-phone', labels.phone, labels.phonePh, phone, setPhone, { inputMode: 'tel', maxLength: 40 })}
      {error ? (
        <p role="alert" className={s.banner}>
          <img src="/ui/alert.svg" alt="" width={18} height={18} />
          {error}
        </p>
      ) : null}
      <button type="submit" disabled={busy} className={`btn btn-secondary btn-block ${s.lookupBtn}`}>
        <img src="/ui/search-20.svg" alt="" width={20} height={20} />
        {labels.lookupButton}
      </button>
    </form>
  )
}
