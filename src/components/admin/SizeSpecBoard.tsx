'use client'

import { useCallback, useState } from 'react'
import { useRouter } from 'next/navigation'
import { adminErrorMessage } from '@/lib/admin/error-messages'
import { priceAmountProblem } from '@/lib/admin/price-limits'
import { Toast } from '@/components/ui'
import { AdminConfirm, NoPermission } from './AdminConfirm'
import s from './admin-v2.module.css'

export type SizeSpecRow = { key: string; labelKo: string; labelJa: string; priceKrw: number; priceJpy: number; active: boolean }

type Draft = { labelKo: string; labelJa: string; krw: string; jpy: string; active: boolean }

const EMPTY: SizeSpecRow = { key: '', labelKo: '', labelJa: '', priceKrw: 0, priceJpy: 0, active: true }

function draftOf(row: SizeSpecRow): Draft {
  return { labelKo: row.labelKo, labelJa: row.labelJa, krw: String(row.priceKrw), jpy: String(row.priceJpy), active: row.active }
}

/**
 * 4번 사이즈 규격 5칸(size-spec-1~5) 전용 편집판(4라운드 F).
 * 아직 없는 칸은 빈 행으로 보여 준다 — 이름·원화·엔화를 채우고 저장하면 그 자리에서 새로 만들어진다.
 * 일반 단가 화면과 달리 라벨(이름)까지 여기서 바꾼다 — /api/admin/prices/size-spec 이 그 몫을 한다.
 */
export function SizeSpecBoard({ rows, canEdit }: { rows: Record<string, SizeSpecRow | undefined>; canEdit: boolean }) {
  const router = useRouter()
  const keys = Object.keys(rows)
  const [draft, setDraft] = useState<Record<string, Draft>>(() =>
    Object.fromEntries(keys.map((k) => [k, draftOf(rows[k] ?? EMPTY)])),
  )
  const [confirm, setConfirm] = useState(false)
  const [denied, setDenied] = useState(false)
  const [busy, setBusy] = useState(false)
  const [toast, setToast] = useState<{ kind: 'success' | 'error'; text: string } | null>(null)
  const closeToast = useCallback(() => setToast(null), [])

  const changed = keys.filter((k) => {
    const base = draftOf(rows[k] ?? EMPTY)
    const d = draft[k] as Draft
    return d.labelKo !== base.labelKo || d.labelJa !== base.labelJa || d.krw !== base.krw || d.jpy !== base.jpy || d.active !== base.active
  })

  function set(key: string, patch: Partial<Draft>) {
    setDraft((prev) => ({ ...prev, [key]: { ...(prev[key] as Draft), ...patch } }))
  }

  function askSave() {
    if (!canEdit) return setDenied(true)
    if (changed.length === 0) return setToast({ kind: 'error', text: '바뀐 내용이 없습니다.' })
    for (const k of changed) {
      const d = draft[k] as Draft
      if (!d.labelKo.trim() || !d.labelJa.trim()) return setToast({ kind: 'error', text: `${k}: 한국어·일본어 이름을 모두 입력해 주세요.` })
      for (const [name, raw] of [['원화', d.krw], ['엔화', d.jpy]] as const) {
        const problem = priceAmountProblem(raw)
        if (problem) return setToast({ kind: 'error', text: `${k} ${name}: ${adminErrorMessage(problem === 'too_large' ? 'price_too_large' : 'price_failed')}` })
      }
    }
    setConfirm(true)
  }

  async function save() {
    setBusy(true)
    const failed: string[] = []
    for (const k of changed) {
      const d = draft[k] as Draft
      try {
        const res = await fetch('/api/admin/prices/size-spec', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            key: k,
            labelKo: d.labelKo.trim(),
            labelJa: d.labelJa.trim(),
            priceKrw: Number(d.krw),
            priceJpy: Number(d.jpy),
            active: d.active,
          }),
        })
        const body = await res.json().catch(() => ({}))
        if (!res.ok || !body?.ok) failed.push(`${k}(${adminErrorMessage(body?.error)})`)
      } catch {
        failed.push(`${k}(${adminErrorMessage('network')})`)
      }
    }
    setBusy(false)
    setConfirm(false)
    const okCount = changed.length - failed.length
    setToast(
      failed.length === 0
        ? { kind: 'success', text: `${okCount}개 사이즈 규격을 저장했습니다.` }
        : { kind: 'error', text: `${okCount}개 저장, ${failed.length}개 실패: ${failed.join(', ')}` },
    )
    router.refresh()
  }

  return (
    <section className={s.card}>
      <h2 className={s.cardTitle}>사이즈 규격 (4번)</h2>
      <p className={s.hint}>이름을 비워 두면 고객 화면에 그 칸이 보이지 않습니다.</p>
      {keys.map((k) => {
        const d = draft[k] as Draft
        return (
          <div key={k} className={s.priceRow} style={{ flexWrap: 'wrap', alignItems: 'flex-start' }}>
            <div className={s.priceLabel} style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <input
                className={s.input}
                style={{ width: 160 }}
                placeholder="이름 (한국어)"
                aria-label={`${k} 한국어 이름`}
                value={d.labelKo}
                onChange={(e) => set(k, { labelKo: e.target.value })}
                readOnly={!canEdit}
                disabled={busy}
              />
              <input
                className={s.input}
                style={{ width: 160 }}
                placeholder="이름 (일본어)"
                aria-label={`${k} 일본어 이름`}
                value={d.labelJa}
                onChange={(e) => set(k, { labelJa: e.target.value })}
                readOnly={!canEdit}
                disabled={busy}
              />
            </div>
            <label className={s.soldToggle}>
              <input type="checkbox" checked={d.active} onChange={(e) => set(k, { active: e.target.checked })} disabled={!canEdit || busy} /> 판매
            </label>
            <div className={s.priceInput}>
              <input
                className={s.input}
                inputMode="numeric"
                aria-label={`${k} 원화 단가`}
                value={d.krw}
                onChange={(e) => set(k, { krw: e.target.value })}
                readOnly={!canEdit}
                disabled={busy}
              />
              <span className={s.unit}>원</span>
            </div>
            <div className={s.priceInput}>
              <input
                className={s.input}
                inputMode="numeric"
                aria-label={`${k} 엔화 단가`}
                value={d.jpy}
                onChange={(e) => set(k, { jpy: e.target.value })}
                readOnly={!canEdit}
                disabled={busy}
              />
              <span className={s.unit}>엔</span>
            </div>
          </div>
        )
      })}

      <div className={s.actions}>
        <button type="button" className={`btn btn-primary ${s.bigBtn}`} onClick={askSave} disabled={busy}>
          저장하기{changed.length > 0 ? ` (${changed.length})` : ''}
        </button>
      </div>

      <AdminConfirm
        open={confirm}
        onClose={() => setConfirm(false)}
        onConfirm={save}
        busy={busy}
        confirmLabel="저장"
        title="사이즈 규격을 저장할까요?"
        description={`바뀐 항목 ${changed.length}개를 저장합니다.\n고객 화면에 즉시 반영됩니다.`}
      />
      <NoPermission open={denied} onClose={() => setDenied(false)} />
      {toast ? <Toast kind={toast.kind} message={toast.text} onClose={closeToast} closeLabel="닫기" /> : null}
    </section>
  )
}
