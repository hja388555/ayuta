'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { adminErrorMessage } from '@/lib/admin/error-messages'
import { AdminConfirm } from './AdminConfirm'
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
  const [confirm, setConfirm] = useState<Record<string, number> | null>(null)

  // 어느 기간이 틀렸는지 이름을 붙여 알려준다. 규칙은 전역 multiplierError 와 같다(0 초과 100 이하, 소수 둘째 자리) —
  // 그 모듈은 payload 설정을 끌고 와 클라이언트에서 부르지 않는다. 최종 판정은 서버가 한다
  function askSave() {
    if (busy) return
    const periodMultipliers: Record<string, number> = {}
    for (const p of periods) {
      const raw = (draft[p.key] ?? '').trim()
      const n = Number(raw)
      if (raw === '' || !Number.isFinite(n) || n <= 0 || n > 100 || Math.abs(n * 100 - Math.round(n * 100)) > 1e-6) {
        setSaved(false)
        setError(`${p.label}: ${adminErrorMessage('invalid_multiplier')}`)
        return
      }
      periodMultipliers[p.key] = n
    }
    setError(null)
    setConfirm(periodMultipliers)
  }

  async function save(periodMultipliers: Record<string, number>) {
    if (busy) return
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
      setConfirm(null)
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
        <button type="button" style={{ ...button, marginTop: 8 }} onClick={askSave} disabled={busy}>
          {busy ? '저장 중…' : '배수 저장'}
        </button>
      ) : null}
      {saved ? <span style={{ marginLeft: 8, fontSize: 12, color: '#2E7D32' }}>저장됨</span> : null}
      {error ? <p style={errorBox}>{error}</p> : null}
      <AdminConfirm
        open={confirm !== null}
        onClose={() => setConfirm(null)}
        onConfirm={() => confirm && void save(confirm)}
        busy={busy}
        confirmLabel="저장"
        title="기간 배수를 저장할까요?"
        description={`${periods.map((p) => `${p.label} ×${confirm?.[p.key] ?? ''}`).join(' · ')}\n고객 화면 금액이 즉시 바뀝니다. 이미 결제된 주문과 발행된 계약서는 그대로 유지됩니다.`}
      />
    </div>
  )
}
