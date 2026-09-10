'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { adminErrorMessage } from '@/lib/admin/error-messages'
import { button, errorBox, input } from './styles'

type Row = { label: string; quantity: string; unitAmount: string }
const EMPTY: Row = { label: '', quantity: '1', unitAmount: '' }

/**
 * 5번 견적 발행(요구사항 1-12 화면 A9-B). 항목명·수량·단가를 줄 단위로 넣으면 합계가 보이고,
 * [발행]하면 링크가 나온다. 링크는 여기서 한 번만 보인다(DB 에는 토큰 해시만 남는다) —
 * 잃어버리면 다시 발행한다(이전 링크는 서버가 회수한다).
 * 화면의 합계는 미리보기다. 실제 합계는 서버가 라인으로 다시 계산한다.
 */
export function QuoteIssueForm({ inquiryId, currency, hasLive }: { inquiryId: number; currency: 'KRW' | 'JPY'; hasLive: boolean }) {
  const router = useRouter()
  const [rows, setRows] = useState<Row[]>([{ ...EMPTY }])
  const [validDays, setValidDays] = useState('7')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [issued, setIssued] = useState<{ url: string; quoteNumber: string } | null>(null)
  const [copied, setCopied] = useState(false)

  const toInt = (s: string) => (/^\d+$/.test(s.trim()) ? Number(s.trim()) : NaN)
  const preview = rows.reduce((sum, r) => {
    const q = toInt(r.quantity)
    const u = toInt(r.unitAmount)
    return Number.isFinite(q) && Number.isFinite(u) ? sum + q * u : sum
  }, 0)
  const money = new Intl.NumberFormat('ko-KR', { style: 'currency', currency })

  const update = (i: number, patch: Partial<Row>) => setRows(rows.map((r, j) => (j === i ? { ...r, ...patch } : r)))

  async function submit() {
    if (busy) return
    const lines = rows.map((r) => ({ label: r.label.trim(), quantity: toInt(r.quantity), unitAmount: toInt(r.unitAmount) }))
    if (lines.some((l) => !l.label || !Number.isFinite(l.quantity) || l.quantity < 1 || !Number.isFinite(l.unitAmount)) || preview <= 0) {
      setError(adminErrorMessage('invalid_quote_lines'))
      return
    }
    if (hasLive && !window.confirm('이미 발행된 견적 링크가 있습니다. 새로 발행하면 이전 링크는 바로 쓸 수 없게 됩니다. 계속할까요?')) return
    setBusy(true)
    setError(null)
    try {
      const res = await fetch('/api/admin/quotes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ inquiryId, lines, validDays: toInt(validDays) || 7 }),
      })
      const body = await res.json().catch(() => ({}))
      if (!res.ok || !body?.ok) {
        setError(adminErrorMessage(body?.error))
        return
      }
      setIssued({ url: `${window.location.origin}${body.path}`, quoteNumber: body.quoteNumber })
      setRows([{ ...EMPTY }])
      router.refresh()
    } catch {
      setError(adminErrorMessage('network'))
    } finally {
      setBusy(false)
    }
  }

  async function copy() {
    if (!issued) return
    try {
      await navigator.clipboard.writeText(issued.url)
      setCopied(true)
    } catch {
      setCopied(false)
    }
  }

  return (
    <div>
      {issued ? (
        <div style={{ background: '#F1F8E9', border: '1px solid #C5E1A5', borderRadius: 6, padding: 12, marginBottom: 12 }}>
          <p style={{ margin: '0 0 6px', fontSize: 13 }}>
            <strong>{issued.quoteNumber}</strong> 발행됨 — 아래 링크를 고객에게 보내 주세요. <strong>이 링크는 지금만 보입니다.</strong>
          </p>
          <input readOnly value={issued.url} style={{ ...input, width: '100%' }} onFocus={(e) => e.currentTarget.select()} />
          <button type="button" style={{ ...button, marginTop: 6 }} onClick={copy}>
            {copied ? '복사됨' : '링크 복사'}
          </button>
        </div>
      ) : null}

      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
        <thead>
          <tr>
            <th style={{ textAlign: 'left', padding: 4 }}>항목명</th>
            <th style={{ textAlign: 'right', padding: 4, width: 70 }}>수량</th>
            <th style={{ textAlign: 'right', padding: 4, width: 130 }}>단가</th>
            <th style={{ width: 40 }} />
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i}>
              <td style={{ padding: 4 }}>
                <input style={{ ...input, width: '100%' }} value={r.label} maxLength={200} onChange={(e) => update(i, { label: e.target.value })} disabled={busy} aria-label={`${i + 1}번 항목명`} />
              </td>
              <td style={{ padding: 4 }}>
                <input style={{ ...input, width: '100%', textAlign: 'right' }} inputMode="numeric" value={r.quantity} onChange={(e) => update(i, { quantity: e.target.value })} disabled={busy} aria-label={`${i + 1}번 수량`} />
              </td>
              <td style={{ padding: 4 }}>
                <input style={{ ...input, width: '100%', textAlign: 'right' }} inputMode="numeric" value={r.unitAmount} onChange={(e) => update(i, { unitAmount: e.target.value })} disabled={busy} aria-label={`${i + 1}번 단가`} />
              </td>
              <td style={{ padding: 4 }}>
                {rows.length > 1 ? (
                  <button type="button" onClick={() => setRows(rows.filter((_, j) => j !== i))} disabled={busy} aria-label={`${i + 1}번 항목 삭제`}>
                    ✕
                  </button>
                ) : null}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 8, flexWrap: 'wrap', gap: 8 }}>
        <button type="button" onClick={() => setRows([...rows, { ...EMPTY }])} disabled={busy || rows.length >= 30}>
          + 항목 추가
        </button>
        <span style={{ fontSize: 14 }}>
          합계 <strong>{money.format(preview)}</strong>
        </span>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 12 }}>
        <label style={{ fontSize: 13 }}>
          유효기간{' '}
          <input style={{ ...input, width: 50, textAlign: 'right' }} inputMode="numeric" value={validDays} onChange={(e) => setValidDays(e.target.value)} disabled={busy} />
          일
        </label>
        <button type="button" style={button} onClick={submit} disabled={busy}>
          {busy ? '발행 중…' : hasLive ? '다시 발행' : '견적 발행'}
        </button>
      </div>
      <p style={{ fontSize: 12, color: '#767B85', margin: '8px 0 0' }}>
        금액 단위는 {currency === 'KRW' ? '원' : '엔'}입니다(문의 언어 기준). 발행 후에는 수정할 수 없고, 고치려면 다시 발행합니다.
      </p>
      {error ? <p style={errorBox}>{error}</p> : null}
    </div>
  )
}

export function QuoteRevokeButton({ quoteId }: { quoteId: number }) {
  const router = useRouter()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  async function revoke() {
    if (busy || !window.confirm('이 견적 링크를 회수할까요? 고객은 더 이상 이 링크로 견적을 볼 수 없습니다.')) return
    setBusy(true)
    try {
      const res = await fetch('/api/admin/quotes/revoke', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ quoteId }) })
      const body = await res.json().catch(() => ({}))
      if (!res.ok || !body?.ok) return setError(adminErrorMessage(body?.error))
      router.refresh()
    } catch {
      setError(adminErrorMessage('network'))
    } finally {
      setBusy(false)
    }
  }
  return (
    <>
      <button type="button" onClick={revoke} disabled={busy} style={{ fontSize: 12 }}>
        회수
      </button>
      {error ? <span style={{ color: '#C62828', fontSize: 12, marginLeft: 6 }}>{error}</span> : null}
    </>
  )
}
