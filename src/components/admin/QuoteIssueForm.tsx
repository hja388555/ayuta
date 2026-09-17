'use client'

import { useEffect, useState, type ReactNode } from 'react'
import { useRouter } from 'next/navigation'
import { adminErrorMessage } from '@/lib/admin/error-messages'
import { quoteIssueProblem } from '@/lib/quotes/lines'
import { TotalBar } from '@/components/ui'
import s from '@/app/(frontend)/manage/(gated)/inquiries/inquiries.module.css'

type Row = { label: string; quantity: string; unitAmount: string }
const EMPTY: Row = { label: '', quantity: '1', unitAmount: '' }
const VALID_DAYS = [3, 7, 14] as const

type Consent = { key: string; labelKo: string; labelJa: string; required: boolean }
const DEFAULT_CONSENT: Consent = {
  key: 'agree',
  labelKo: '위 계약 내용을 모두 확인하였으며 이에 동의합니다.',
  labelJa: '上記契約内容をすべて確認し、これに同意します。',
  required: true,
}
// 이용 약관·개인정보 두 줄은 모든 결제 화면에 공통으로 붙는다(lib/checkout/consents.ts).
// 여기서는 관리자가 보도록 보여만 주고, 발행 요청에는 싣지 않는다
const BASE_CONSENT_LABELS = ['서비스 이용 약관에 동의합니다.', '개인정보 수집 이용에 동의합니다.'] as const

/**
 * [v2] A9-B 견적 발행. 왼쪽(문의 내용 + 견적 항목)과 오른쪽(발행 설정 + 발행 이력)이 한 상태를 공유해
 * 두 칸 전체를 이 컴포넌트가 그린다. 문의 내용·이력 카드는 서버에서 만들어 넘겨받는다.
 * 링크는 발행 직후 한 번만 보인다(DB 에는 토큰 해시만 남는다). 화면 합계는 미리보기이고
 * 실제 합계는 서버가 라인으로 다시 계산한다. 임시 저장은 이 브라우저(localStorage)에만 남는다.
 */
export function QuoteIssueForm({
  inquiryId,
  currency,
  hasLive,
  liveQuoteId,
  inquiryCard,
  history,
}: {
  inquiryId: number
  currency: 'KRW' | 'JPY'
  hasLive: boolean
  liveQuoteId?: number | null
  inquiryCard: ReactNode
  history: ReactNode
}) {
  const router = useRouter()
  const draftKey = `ayuta:quote-draft:${inquiryId}`
  const [rows, setRows] = useState<Row[]>([{ ...EMPTY }])
  const [validDays, setValidDays] = useState<number>(7)
  // 이 견적에만 쓰는 계약서(Q53). 발행하면 문구가 그대로 굳는다 — 고치려면 회수하고 다시 발행한다
  const [contractTitle, setContractTitle] = useState('')
  const [contractBody, setContractBody] = useState('')
  const [consents, setConsents] = useState<Consent[]>([{ ...DEFAULT_CONSENT }])
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [issued, setIssued] = useState<{ url: string; quoteNumber: string; copied: boolean } | null>(null)

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(draftKey)
      if (!raw) return
      const d = JSON.parse(raw) as { rows?: Row[]; validDays?: number }
      if (Array.isArray(d.rows) && d.rows.length) setRows(d.rows.slice(0, 30))
      if (VALID_DAYS.includes(d.validDays as 7)) setValidDays(d.validDays as number)
    } catch {
      /* 임시 저장본이 없거나 깨졌으면 빈 폼 */
    }
  }, [draftKey])

  const toInt = (v: string) => (/^\d+$/.test(v.trim()) ? Number(v.trim()) : NaN)
  const preview = rows.reduce((sum, r) => {
    const q = toInt(r.quantity)
    const u = toInt(r.unitAmount)
    return Number.isFinite(q) && Number.isFinite(u) ? sum + q * u : sum
  }, 0)
  const money = new Intl.NumberFormat('ko-KR', { style: 'currency', currency })
  const until = new Date(Date.now() + validDays * 86_400_000 + 9 * 3_600_000).toISOString().slice(0, 10)
  const unit = currency === 'KRW' ? '원' : '엔'

  const update = (i: number, patch: Partial<Row>) => setRows(rows.map((r, j) => (j === i ? { ...r, ...patch } : r)))

  function saveDraft() {
    try {
      window.localStorage.setItem(draftKey, JSON.stringify({ rows, validDays }))
      setNotice('이 브라우저에 임시 저장했습니다.')
    } catch {
      setNotice('임시 저장에 실패했습니다.')
    }
  }

  async function copy(url: string) {
    try {
      await navigator.clipboard.writeText(url)
      return true
    } catch {
      return false
    }
  }

  async function submit() {
    if (busy) return
    setNotice(null)
    const lines = rows.map((r) => ({ label: r.label.trim(), quantity: toInt(r.quantity), unitAmount: toInt(r.unitAmount) }))
    const noLabel = lines.findIndex((l) => !l.label)
    if (noLabel >= 0) {
      setError(`${noLabel + 1}번 항목: 항목명을 입력해 주세요.`)
      return
    }
    // 수량 1~999 · 금액 0~10억 · 합계 100억 이하. 서버(/api/admin/quotes)도 같은 함수로 다시 본다
    const problem = quoteIssueProblem(lines)
    if (problem) {
      setError(problem)
      return
    }
    if (hasLive && !window.confirm('이미 발행된 견적 링크가 있습니다. 새로 발행하면 이전 링크는 바로 쓸 수 없게 됩니다. 계속할까요?')) return
    setBusy(true)
    setError(null)
    try {
      const res = await fetch('/api/admin/quotes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          inquiryId,
          lines,
          validDays,
          contractTitle: contractTitle.trim(),
          contractBody: contractBody.trim(),
          contractConsents: consents.map((c) => ({ ...c, labelKo: c.labelKo.trim(), labelJa: c.labelJa.trim() })),
        }),
      })
      const body = await res.json().catch(() => ({}))
      if (!res.ok || !body?.ok) {
        setError(body?.error === 'quote_too_large' && typeof body?.detail === 'string' ? body.detail : adminErrorMessage(body?.error))
        return
      }
      const url = `${window.location.origin}${body.path}`
      setIssued({ url, quoteNumber: body.quoteNumber, copied: await copy(url) })
      setRows([{ ...EMPTY }])
      try {
        window.localStorage.removeItem(draftKey)
      } catch {
        /* 무시 */
      }
      router.refresh()
    } catch {
      setError(adminErrorMessage('network'))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className={s.grid}>
      <div className={s.colMain}>
        {inquiryCard}
        <section className={s.card} id="quote">
          <h2 className={s.cardTitle}>견적 항목</h2>
          <p className={s.muted}>항목명과 금액을 직접 입력합니다. 입력한 값이 그대로 고객 견적서에 표시됩니다.</p>
          <div className={s.lineHead} aria-hidden="true">
            <span className={s.cLabel}>항목명</span>
            <span className={s.cQty}>수량</span>
            <span className={s.cAmt}>금액 ({unit})</span>
            <span className={s.cDel} />
          </div>
          {rows.map((r, i) => (
            <div className={s.line} key={i}>
              <span className={s.cLabel}>
                <input className={s.field} value={r.label} maxLength={200} onChange={(e) => update(i, { label: e.target.value })} disabled={busy} aria-label={`${i + 1}번 항목명`} />
              </span>
              <span className={s.cQty}>
                <input className={s.field} inputMode="numeric" value={r.quantity} onChange={(e) => update(i, { quantity: e.target.value })} disabled={busy} aria-label={`${i + 1}번 수량`} />
              </span>
              <span className={s.cAmt}>
                <input className={s.field} inputMode="numeric" value={r.unitAmount} onChange={(e) => update(i, { unitAmount: e.target.value })} disabled={busy} aria-label={`${i + 1}번 금액`} />
              </span>
              <span className={s.cDel}>
                <button type="button" className={s.del} onClick={() => setRows(rows.length > 1 ? rows.filter((_, j) => j !== i) : [{ ...EMPTY }])} disabled={busy} aria-label={`${i + 1}번 항목 삭제`}>
                  <img src="/ui/admin-trash.svg" alt="" width={16} height={16} />
                </button>
              </span>
            </div>
          ))}
          <button type="button" className={s.add} onClick={() => setRows([...rows, { ...EMPTY }])} disabled={busy || rows.length >= 30}>
            + 항목 추가
          </button>
          <TotalBar label="합계 (자동 계산)" amount={money.format(preview)} />
          <p className={s.muted} style={{ fontSize: 12 }}>
            금액은 단가이며 수량을 곱해 합산합니다. 단위는 {unit}입니다(문의 언어 기준). 발행 후에는 수정할 수 없고, 고치려면 다시 발행합니다.
          </p>
        </section>

        <section className={s.card}>
          <h2 className={s.cardTitle}>이 견적의 계약서</h2>
          <label className={s.fieldGroup}>
            계약서 제목
            <input
              className={s.field}
              value={contractTitle}
              maxLength={200}
              onChange={(e) => setContractTitle(e.target.value)}
              disabled={busy}
              placeholder="AYUTA 광고 서비스 계약서"
            />
          </label>
          <label className={s.fieldGroup}>
            계약서 본문
            <textarea
              className={s.fieldArea}
              value={contractBody}
              maxLength={20000}
              rows={12}
              onChange={(e) => setContractBody(e.target.value)}
              disabled={busy}
            />
          </label>
          <p className={s.muted} style={{ fontSize: 12 }}>
            · 발행하면 이 문구는 고정됩니다. 고치려면 견적을 회수하고 다시 발행해야 합니다. {'{{items}}'} {'{{amount}}'} 자리에는 견적 내역과 금액이 자동으로 들어갑니다.
          </p>
        </section>

        <section className={s.card}>
          <h2 className={s.cardTitle}>고객 동의 항목</h2>
          {BASE_CONSENT_LABELS.map((label) => (
            <label key={label} className={s.fieldGroup}>
              공통 (모든 결제 화면)
              <input className={s.field} value={label} readOnly disabled />
            </label>
          ))}
          {consents.map((c, i) => (
            <label key={i} className={s.fieldGroup}>
              이 견적 동의 {i + 1} {c.required ? '(필수)' : '(선택)'}
              <input
                className={s.field}
                value={c.labelKo}
                maxLength={300}
                onChange={(e) => setConsents(consents.map((x, j) => (j === i ? { ...x, labelKo: e.target.value } : x)))}
                disabled={busy}
                aria-label={`${i + 1}번 동의 문구(한국어)`}
              />
              <input
                className={s.field}
                value={c.labelJa}
                maxLength={300}
                onChange={(e) => setConsents(consents.map((x, j) => (j === i ? { ...x, labelJa: e.target.value } : x)))}
                disabled={busy}
                aria-label={`${i + 1}번 동의 문구(일본어)`}
              />
            </label>
          ))}
          <button
            type="button"
            className={s.add}
            onClick={() => setConsents([...consents, { key: `agree${consents.length + 1}`, labelKo: '', labelJa: '', required: true }])}
            disabled={busy || consents.length >= 20}
          >
            + 동의 항목 추가
          </button>
          <p className={s.muted} style={{ fontSize: 12 }}>
            · 이용 약관과 개인정보 두 줄은 모든 결제 화면에 공통으로 들어갑니다. 위에는 이 견적에만 쓰는 항목을 적습니다.
          </p>
        </section>
      </div>

      <div className={s.colSide}>
        <section className={s.card}>
          <h2 className={s.cardTitle}>발행 설정</h2>
          <label className={s.fieldGroup}>
            유효기간
            <span className={s.selectBox}>
              <img src="/ui/admin-calendar.svg" alt="" className={s.icon18} />
              <span className={s.selectText}>
                {validDays}일 ({until}까지)
              </span>
              <img src="/ui/admin-chevron-down.svg" alt="" className={s.icon16} />
              <select value={validDays} onChange={(e) => setValidDays(Number(e.target.value))} disabled={busy}>
                {VALID_DAYS.map((d) => (
                  <option key={d} value={d}>
                    {d}일
                  </option>
                ))}
              </select>
            </span>
          </label>
          <label className={s.fieldGroup}>
            발송 방법
            <span className={`${s.selectBox} ${s.selectDisabled}`}>
              <span className={s.selectText}>링크 복사</span>
              <img src="/ui/admin-chevron-down.svg" alt="" className={s.icon16} />
              <select disabled defaultValue="link" aria-describedby="send-note">
                <option value="link">링크 복사</option>
                <option value="email">이메일 + 문자</option>
              </select>
            </span>
          </label>
          <div className={s.note} id="send-note">
            <p>· 메일·문자 발송은 Q28 이후 — 지금은 링크 복사</p>
            <p>· 발행하면 결제 링크가 복사됩니다. 고객에게 직접 전달해 주세요.</p>
            <p>· 유효기간이 지나거나 결제가 완료되면 링크는 자동으로 만료됩니다.</p>
          </div>

          {issued ? (
            <div className={s.issued} role="status">
              <p>
                <strong>{issued.quoteNumber}</strong> 발행됨 — {issued.copied ? '링크를 복사했습니다.' : '아래 링크를 복사해 주세요.'} <strong>이 링크는 지금만 보입니다.</strong>
              </p>
              <input readOnly value={issued.url} className={s.field} onFocus={(e) => e.currentTarget.select()} />
              <button type="button" className="btn btn-outline" onClick={async () => setIssued({ ...issued, copied: await copy(issued.url) })}>
                {issued.copied ? '복사됨' : '링크 복사'}
              </button>
            </div>
          ) : null}

          <button type="button" className={`btn btn-primary btn-block ${s.bigBtn}`} onClick={submit} disabled={busy}>
            {busy ? '발행 중…' : hasLive ? '다시 발행하고 링크 복사' : '발행하고 링크 복사'}
          </button>
          <div className={s.row2}>
            <button type="button" className={`btn btn-outline ${s.bigBtn}`} onClick={saveDraft} disabled={busy}>
              임시 저장
            </button>
            {liveQuoteId ? <QuoteRevokeButton quoteId={liveQuoteId} /> : (
              <button type="button" className={`btn btn-outline ${s.bigBtn}`} disabled title="회수할 견적이 없습니다">
                견적 회수
              </button>
            )}
          </div>
          {notice ? <p className={s.muted}>{notice}</p> : null}
          {error ? <p className={s.error}>{error}</p> : null}
        </section>
        {history}
      </div>
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
      <button type="button" className={`btn btn-outline ${s.bigBtn}`} onClick={revoke} disabled={busy}>
        견적 회수
      </button>
      {error ? <span className={s.error}>{error}</span> : null}
    </>
  )
}
