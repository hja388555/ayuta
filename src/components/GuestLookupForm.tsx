'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

type Labels = { orderNumber: string; email: string; phone: string; lookupButton: string; lookupFailed: string; network: string }

/**
 * 비회원 주문 조회(요구사항 126행 — 로그인 화면 하단). 주문번호·이메일·연락처 세 가지가 모두
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

  const field = { display: 'block', width: '100%', marginTop: 6, padding: '10px 12px', border: '1px solid var(--ink-200, #D6D9DE)', borderRadius: 6, fontSize: 'var(--fs-body)', fontFamily: 'inherit' } as const
  return (
    <form onSubmit={submit} style={{ display: 'grid', gap: 16 }}>
      <label>
        {labels.orderNumber}
        <input style={field} value={orderNumber} onChange={(e) => setOrderNumber(e.target.value)} required disabled={busy} maxLength={60} />
      </label>
      <label>
        {labels.email}
        <input style={field} type="email" value={email} onChange={(e) => setEmail(e.target.value)} required disabled={busy} maxLength={200} />
      </label>
      <label>
        {labels.phone}
        <input style={field} inputMode="tel" value={phone} onChange={(e) => setPhone(e.target.value)} required disabled={busy} maxLength={40} />
      </label>
      {error ? (
        <p role="alert" style={{ margin: 0, color: '#C62828' }}>
          {error}
        </p>
      ) : null}
      <button type="submit" disabled={busy} style={{ padding: '14px 0', fontSize: 'var(--fs-body)' }}>
        {labels.lookupButton}
      </button>
    </form>
  )
}
