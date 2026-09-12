'use client'

import { useCallback, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { adminErrorMessage } from '@/lib/admin/error-messages'
import { priceAmountProblem } from '@/lib/admin/price-limits'
import { Toast } from '@/components/ui'
import { AdminConfirm, NoPermission } from './AdminConfirm'
import s from './admin-v2.module.css'

export type PriceRow = { id: number; key: string; labelKo: string; labelJa: string; priceKrw: number; priceJpy: number; active: boolean }
export type PriceSection = { title: string; rows: Array<PriceRow & { sub?: string }> }

type Draft = { krw: string; jpy: string; active: boolean }

/**
 * A8 단가 관리(Figma 230:2) 본문. 원화/엔화 토글은 어느 칸을 보여 주고 고칠지만 바꾼다 — 두 값은 계속 함께 저장된다.
 * [저장하기]는 바뀐 줄만 골라 기존 줄 단위 API(/api/admin/prices)를 차례로 부른다(배치 API 는 없다).
 * 저장 전에 A11 ⑦ 확인 팝업, 중간관리자가 누르면 ⑧ 권한 없음.
 */
export function PriceBoard({ sections, canEdit }: { sections: PriceSection[]; canEdit: boolean }) {
  const router = useRouter()
  const all = useMemo(() => sections.flatMap((sec) => sec.rows), [sections])
  const initial = useMemo(() => Object.fromEntries(all.map((r) => [r.id, { krw: String(r.priceKrw), jpy: String(r.priceJpy), active: r.active }])) as Record<number, Draft>, [all])
  const [draft, setDraft] = useState(initial)
  const [cur, setCur] = useState<'krw' | 'jpy'>('krw')
  const [confirm, setConfirm] = useState(false)
  const [denied, setDenied] = useState(false)
  const [busy, setBusy] = useState(false)
  const [toast, setToast] = useState<{ kind: 'success' | 'error'; text: string } | null>(null)
  const closeToast = useCallback(() => setToast(null), [])

  const changed = all.filter((r) => {
    const d = (draft[r.id] as Draft)
    return d && (d.krw !== String(r.priceKrw) || d.jpy !== String(r.priceJpy) || d.active !== r.active)
  })

  function set(id: number, patch: Partial<Draft>) {
    setDraft((prev) => ({ ...prev, [id]: { ...(prev[id] as Draft), ...patch } }))
  }

  function askSave() {
    if (!canEdit) return setDenied(true)
    if (changed.length === 0) return setToast({ kind: 'error', text: '바뀐 단가가 없습니다.' })
    // 빈칸·소수·음수·10억 초과는 여기서 먼저 막는다. 최종 판정은 서버(API · 컬렉션 validate)가 한다
    for (const r of changed) {
      const d = draft[r.id] as Draft
      for (const [name, raw] of [['원화', d.krw], ['엔화', d.jpy]] as const) {
        const problem = priceAmountProblem(raw)
        if (problem) return setToast({ kind: 'error', text: `${r.labelKo} ${name}: ${adminErrorMessage(problem === 'too_large' ? 'price_too_large' : 'price_failed')}` })
      }
    }
    setConfirm(true)
  }

  async function save() {
    setBusy(true)
    const failed: string[] = []
    for (const r of changed) {
      const d = (draft[r.id] as Draft)
      try {
        const res = await fetch('/api/admin/prices', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id: r.id, priceKrw: Number(d.krw), priceJpy: Number(d.jpy), active: d.active }),
        })
        const body = await res.json().catch(() => ({}))
        if (!res.ok || !body?.ok) failed.push(`${r.labelKo}(${adminErrorMessage(body?.error)})`)
      } catch {
        failed.push(`${r.labelKo}(${adminErrorMessage('network')})`)
      }
    }
    setBusy(false)
    setConfirm(false)
    const okCount = changed.length - failed.length
    setToast(
      failed.length === 0
        ? { kind: 'success', text: `${okCount}개 단가를 저장했습니다.` }
        : { kind: 'error', text: `${okCount}개 저장, ${failed.length}개 실패: ${failed.join(', ')}` },
    )
    router.refresh()
  }

  const unit = cur === 'krw' ? '원' : '엔'
  return (
    <>
      <div className={s.seg} role="group" aria-label="통화">
        {(['krw', 'jpy'] as const).map((c) => (
          <button key={c} type="button" className={cur === c ? `${s.segBtn} ${s.segOn}` : s.segBtn} aria-pressed={cur === c} onClick={() => setCur(c)}>
            {c === 'krw' ? '원화 (KRW)' : '엔화 (JPY)'}
          </button>
        ))}
      </div>

      {sections.map((sec) => (
        <section key={sec.title} className={s.card}>
          <h2 className={s.cardTitle}>{sec.title}</h2>
          {sec.rows.map((r) => {
            const d = (draft[r.id] as Draft)
            const value = cur === 'krw' ? d.krw : d.jpy
            const isDirty = value !== String(cur === 'krw' ? r.priceKrw : r.priceJpy)
            return (
              <div key={r.id} className={s.priceRow} style={{ opacity: d.active ? 1 : 0.55 }}>
                <div className={s.priceLabel}>
                  <p className={s.priceName}>{r.labelKo}</p>
                  <p className={s.priceSub}>{r.sub ?? r.labelJa}</p>
                </div>
                <label className={s.soldToggle}>
                  <input type="checkbox" checked={d.active} onChange={(e) => set(r.id, { active: e.target.checked })} disabled={!canEdit || busy} /> 판매
                </label>
                <div className={s.priceInput}>
                  <input
                    className={isDirty ? `${s.input} ${s.dirty}` : s.input}
                    inputMode="numeric"
                    aria-label={`${r.labelKo} ${cur === 'krw' ? '원화' : '엔화'} 단가`}
                    value={value}
                    onChange={(e) => set(r.id, cur === 'krw' ? { krw: e.target.value } : { jpy: e.target.value })}
                    readOnly={!canEdit}
                    disabled={busy}
                  />
                  <span className={s.unit}>{unit}</span>
                </div>
              </div>
            )
          })}
        </section>
      ))}

      <div className={s.actions}>
        <button type="button" className={`btn btn-primary ${s.bigBtn}`} onClick={askSave} disabled={busy}>
          저장하기{changed.length > 0 ? ` (${changed.length})` : ''}
        </button>
        <button type="button" className={`btn btn-outline ${s.bigBtn}`} onClick={() => setDraft(initial)} disabled={busy || changed.length === 0}>
          되돌리기
        </button>
      </div>

      <AdminConfirm
        open={confirm}
        onClose={() => setConfirm(false)}
        onConfirm={save}
        busy={busy}
        confirmLabel="저장"
        title="단가를 저장할까요?"
        description={`바뀐 항목 ${changed.length}개를 저장합니다.\n고객 화면 금액이 즉시 바뀝니다. 이미 결제된 주문과 발행된 계약서는 그대로 유지됩니다.`}
      />
      <NoPermission open={denied} onClose={() => setDenied(false)} />
      {toast ? <Toast kind={toast.kind} message={toast.text} onClose={closeToast} closeLabel="닫기" /> : null}
    </>
  )
}
