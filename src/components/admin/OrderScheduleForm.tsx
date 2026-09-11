'use client'

import { useState, type ReactNode } from 'react'
import { useRouter } from 'next/navigation'
import { adminErrorMessage } from '@/lib/admin/error-messages'
import { errorBox, okBox } from './styles'
import s from './AdminOrders.module.css'

type Props = {
  orderId: number
  /** 'YYYY-MM-DD' 또는 '' (미정) */
  initial: { contractStart: string; contractEnd: string; adStartDate: string }
  /** 저장 버튼 옆에 붙는 보조 버튼(Figma A4 "계약서 보기") */
  extraAction?: ReactNode
}

/**
 * 계약기간·광고시작일 저장 폼.
 *
 * 세 필드를 항상 함께 보낸다 — 빈칸은 null(미정으로 되돌리기)이다. API 는 "키를 안
 * 보냄"과 "null"을 구분하므로, 화면에서 지운 값을 안 보내면 지워지지 않는다.
 * 역순 기간 검증은 서버가 한다(invalid_schedule) — 여기서 미리 막지 않는 이유는
 * 판정이 두 곳에 생기면 갈라지기 때문이다.
 */
export function OrderScheduleForm({ orderId, initial, extraAction }: Props) {
  const router = useRouter()
  const [form, setForm] = useState(initial)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)

  const set = (key: keyof Props['initial'], value: string) => setForm((prev) => ({ ...prev, [key]: value }))

  async function submit() {
    if (busy) return
    setBusy(true)
    setError(null)
    setMessage(null)
    try {
      const res = await fetch('/api/admin/orders/schedule', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          orderId,
          contractStart: form.contractStart || null,
          contractEnd: form.contractEnd || null,
          adStartDate: form.adStartDate || null,
        }),
      })
      const body = await res.json().catch(() => ({}))
      if (!res.ok || !body?.ok) {
        setError(adminErrorMessage(body?.error))
        return
      }
      // changed 가 비어 있으면 저장은 성공했지만 바뀐 값이 없다는 뜻이다 —
      // "저장했습니다"라고만 하면 운영자가 값이 반영됐다고 오해한다
      const changed: string[] = Array.isArray(body.changed) ? body.changed : []
      setMessage(changed.length > 0 ? '계약기간을 저장했습니다.' : '바뀐 값이 없습니다.')
      router.refresh()
    } catch {
      setError(adminErrorMessage('network'))
    } finally {
      setBusy(false)
    }
  }

  const field = (key: keyof Props['initial'], text: string) => (
    <div className={s.field}>
      <label htmlFor={`schedule-${key}`}>{text}</label>
      <input
        id={`schedule-${key}`}
        type="date"
        className={s.input}
        value={form[key]}
        onChange={(e) => set(key, e.target.value)}
        disabled={busy}
      />
    </div>
  )

  return (
    <>
      <div className={s.fieldRow}>
        {field('contractStart', '시작일')}
        {field('contractEnd', '종료일')}
      </div>
      {field('adStartDate', '광고 진행일')}
      <p className={s.hint}>비워 두면 미정(협의 중)으로 저장됩니다.</p>
      <div className={s.btnRow}>
        <button type="button" className={`btn btn-primary ${s.bigBtn}`} onClick={submit} disabled={busy}>
          {busy ? '저장 중…' : '계약기간 저장'}
        </button>
        {extraAction}
      </div>
      {error ? <p style={errorBox}>{error}</p> : null}
      {message ? <p style={okBox}>{message}</p> : null}
    </>
  )
}
