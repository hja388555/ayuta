'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { adminErrorMessage } from '@/lib/admin/error-messages'
import { button, errorBox, input } from './styles'

type Props = {
  periods: Array<{ key: string; label: string }>
  values: Record<string, number>
  canEdit: boolean
}

/**
 * 4번 광고 기간별 배수. 네 기간을 한 번에 저장한다(라우트가 전부를 요구한다).
 * 합계 = (고른 항목 단가 합) × 배수, 원 단위 내림. 저장하면 다음 견적·주문부터 바로 쓰이고,
 * 이미 만들어진 주문 금액은 바뀌지 않는다.
 */
export function PeriodMultiplierForm({ periods, values, canEdit }: Props) {
  const router = useRouter()
  const [draft, setDraft] = useState<Record<string, string>>(Object.fromEntries(periods.map((p) => [p.key, String(values[p.key] ?? '')])))
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)

  async function save() {
    if (busy) return
    const periodMultipliers: Record<string, number> = {}
    for (const p of periods) {
      const raw = (draft[p.key] ?? '').trim()
      const n = Number(raw)
      if (raw === '' || !Number.isFinite(n)) {
        setError(adminErrorMessage('invalid_multiplier'))
        return
      }
      periodMultipliers[p.key] = n
    }
    setBusy(true)
    setError(null)
    setSaved(false)
    try {
      const res = await fetch('/api/admin/pricing-settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ periodMultipliers }),
      })
      const body = await res.json().catch(() => ({}))
      if (!res.ok || !body?.ok) {
        const label = periods.find((p) => p.key === body?.field)?.label
        setError(label ? `${label}: ${adminErrorMessage(body?.error)}` : adminErrorMessage(body?.error))
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

  return (
    <div>
      <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
        {periods.map((p) => (
          <label key={p.key} style={{ fontSize: 13 }}>
            <span style={{ display: 'block', fontSize: 12, color: '#767B85', marginBottom: 4 }}>{p.label}</span>
            ×{' '}
            <input
              style={{ ...input, width: 80, textAlign: 'right' }}
              inputMode="decimal"
              value={draft[p.key] ?? ''}
              onChange={(e) => setDraft({ ...draft, [p.key]: e.target.value })}
              disabled={!canEdit || busy}
            />
          </label>
        ))}
      </div>
      <p style={{ fontSize: 12, color: '#767B85', margin: '8px 0 0' }}>
        합계 = 고른 항목 단가의 합 × 배수 (원·엔 단위 내림). 소수 둘째 자리까지 입력할 수 있습니다.
      </p>
      {canEdit ? (
        <button type="button" style={{ ...button, marginTop: 8 }} onClick={save} disabled={busy}>
          {busy ? '저장 중…' : '배수 저장'}
        </button>
      ) : null}
      {saved ? <span style={{ marginLeft: 8, fontSize: 12, color: '#2E7D32' }}>저장됨</span> : null}
      {error ? <p style={errorBox}>{error}</p> : null}
    </div>
  )
}
