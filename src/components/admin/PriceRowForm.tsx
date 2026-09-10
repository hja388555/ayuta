'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { adminErrorMessage } from '@/lib/admin/error-messages'
import { button, errorBox, input, td } from './styles'

type Props = {
  id: number
  keyName: string
  labelKo: string
  labelJa: string
  priceKrw: number
  priceJpy: number
  active: boolean
  canEdit: boolean
}

/**
 * 단가 한 줄. 금액은 원·엔 모두 정수 최소단위다(원 = 1, 엔 = 1).
 * /api/admin/prices 를 부른다 — Payload REST 는 쓰지 않는다(라우트 주석 참고).
 * manager 는 조회만 한다: 입력칸을 잠그고 저장 버튼을 그리지 않는다(서버도 403 으로 막는다).
 */
export function PriceRowForm(props: Props) {
  const router = useRouter()
  const [krw, setKrw] = useState(String(props.priceKrw))
  const [jpy, setJpy] = useState(String(props.priceJpy))
  const [active, setActive] = useState(props.active)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)

  const dirty = krw !== String(props.priceKrw) || jpy !== String(props.priceJpy) || active !== props.active

  async function save() {
    if (busy) return
    // 빈칸·소수·음수는 여기서 먼저 막는다. 최종 판정은 서버(컬렉션 validate)가 한다
    const priceKrw = Number(krw)
    const priceJpy = Number(jpy)
    if (krw.trim() === '' || jpy.trim() === '' || !Number.isInteger(priceKrw) || !Number.isInteger(priceJpy) || priceKrw < 0 || priceJpy < 0) {
      setError(adminErrorMessage('price_failed'))
      return
    }
    setBusy(true)
    setError(null)
    setSaved(false)
    try {
      const res = await fetch('/api/admin/prices', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: props.id, priceKrw, priceJpy, active }),
      })
      const body = await res.json().catch(() => ({}))
      if (!res.ok || !body?.ok) {
        setError(adminErrorMessage(body?.error))
        return
      }
      setSaved(true)
      router.refresh()
    } catch {
      setError(adminErrorMessage('network'))
    } finally {
      setBusy(false)
    }
  }

  const disabled = !props.canEdit || busy
  return (
    <tr style={{ opacity: active ? 1 : 0.55 }}>
      <td style={td}>
        <div>{props.labelKo}</div>
        <div style={{ fontSize: 12, color: '#767B85' }}>{props.labelJa}</div>
        <div style={{ fontSize: 11, color: '#A0A4AB' }}>{props.keyName}</div>
      </td>
      <td style={td}>
        <input
          style={{ ...input, width: 120, textAlign: 'right' }}
          inputMode="numeric"
          aria-label={`${props.labelKo} 원화 단가`}
          value={krw}
          onChange={(e) => setKrw(e.target.value)}
          disabled={disabled}
        />
      </td>
      <td style={td}>
        <input
          style={{ ...input, width: 110, textAlign: 'right' }}
          inputMode="numeric"
          aria-label={`${props.labelKo} 엔화 단가`}
          value={jpy}
          onChange={(e) => setJpy(e.target.value)}
          disabled={disabled}
        />
      </td>
      <td style={td}>
        <label style={{ fontSize: 13 }}>
          <input type="checkbox" checked={active} onChange={(e) => setActive(e.target.checked)} disabled={disabled} /> 판매
        </label>
      </td>
      <td style={td}>
        {props.canEdit ? (
          <button type="button" style={button} onClick={save} disabled={busy || !dirty}>
            {busy ? '저장 중…' : '저장'}
          </button>
        ) : null}
        {saved && !dirty ? <span style={{ marginLeft: 8, fontSize: 12, color: '#2E7D32' }}>저장됨</span> : null}
        {error ? <p style={errorBox}>{error}</p> : null}
      </td>
    </tr>
  )
}
