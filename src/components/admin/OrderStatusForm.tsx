'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { adminErrorMessage, GENERIC_ERROR } from '@/lib/admin/error-messages'
import { AdminConfirm } from './AdminConfirm'
import { errorBox, okBox } from './styles'
import s from './AdminOrders.module.css'

type Props = {
  orderId: number
  currentLabel: string
  /** 서버가 ALLOWED 전이표로 이미 걸러낸 후보. 화면은 이 목록만 보여준다 */
  /** irreversible: 도착하면 더 바꿀 수 없는 상태(requiresTransitionConfirm) — 저장 전에 한 번 더 묻는다 */
  options: { value: string; label: string; irreversible?: boolean }[]
}

/**
 * 상태 변경 폼(Figma [v2] A4 "상태 변경" 카드 — 라디오 목록 + 저장).
 *
 * 맨 위 칸은 현재 상태(고를 수 없음), 그 아래가 서버(availableTransitions)가 만든 후보다 —
 * 여기서 다시 판단하지 않는다. 화면과 서버가 각자 전이 규칙을 들고 있으면 언젠가 갈라진다.
 * 저장 성공 후에는 router.refresh() 로 서버 컴포넌트를 다시 그린다.
 */
export function OrderStatusForm({ orderId, currentLabel, options }: Props) {
  const router = useRouter()
  const [to, setTo] = useState('')
  const [reason, setReason] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [done, setDone] = useState(false)
  const [asking, setAsking] = useState(false)
  const target = options.find((o) => o.value === to)

  // 되돌릴 수 없는 전이는 바로 보내지 않고 확인 팝업을 먼저 띄운다
  function requestSubmit() {
    if (!to || busy) return
    if (target?.irreversible) return setAsking(true)
    void submit()
  }

  async function submit() {
    if (!to || busy) return
    setBusy(true)
    setError(null)
    setDone(false)
    try {
      const res = await fetch('/api/admin/orders/transition', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orderId, to, reason: reason.trim() || undefined }),
      })
      const body = await res.json().catch(() => ({}))
      if (!res.ok || !body?.ok) {
        setError(adminErrorMessage(body?.error))
        return
      }
      setTo('')
      setReason('')
      setDone(true)
      router.refresh()
    } catch {
      // 네트워크 자체가 끊긴 경우. 서버가 준 코드가 없으므로 별도 문구를 쓴다
      setError(adminErrorMessage('network'))
    } finally {
      // 실패해도 팝업을 닫아 아래 에러 문구가 보이게 한다
      setAsking(false)
      setBusy(false)
    }
  }

  return (
    <>
      <fieldset className={s.radios} disabled={busy}>
        <legend className="sr-only" style={{ position: 'absolute', width: 1, height: 1, overflow: 'hidden', clip: 'rect(0 0 0 0)' }}>
          바꿀 상태
        </legend>
        <label className={`${s.radio} ${s.radioCurrent} ${to === '' ? s.radioOn : ''}`}>
          <input type="radio" name="status-to" checked={to === ''} onChange={() => setTo('')} />
          {currentLabel}
          <small>현재</small>
        </label>
        {options.map((o) => (
          <label key={o.value} className={`${s.radio} ${to === o.value ? s.radioOn : ''}`}>
            <input type="radio" name="status-to" value={o.value} checked={to === o.value} onChange={() => setTo(o.value)} />
            {o.label}
          </label>
        ))}
      </fieldset>
      {options.length === 0 ? (
        <p className={s.hint}>현재 상태({currentLabel})에서 바꿀 수 있는 상태가 없습니다.</p>
      ) : (
        <>
          <input
            className={s.input}
            placeholder="사유 (선택, 이력에 남습니다)"
            aria-label="변경 사유"
            value={reason}
            maxLength={500}
            onChange={(e) => setReason(e.target.value)}
            disabled={busy}
          />
          <button type="button" className={`btn btn-primary btn-block ${s.bigBtn}`} onClick={requestSubmit} disabled={!to || busy}>
            {busy ? '변경 중…' : '상태 저장'}
          </button>
        </>
      )}
      {error ? <p style={errorBox}>{error || GENERIC_ERROR}</p> : null}
      {done ? <p style={okBox}>상태를 변경했습니다.</p> : null}
      <AdminConfirm
        open={asking}
        onClose={() => setAsking(false)}
        onConfirm={() => void submit()}
        tone="danger"
        busy={busy}
        confirmLabel="상태 변경"
        title={`${currentLabel} → ${target?.label ?? ''}(으)로 바꿀까요?`}
        description={'이 상태로 바꾸면 되돌릴 수 없습니다.\n다시 다른 상태로 바꿀 수 없으니 한 번 더 확인해 주세요.'}
      />
    </>
  )
}
