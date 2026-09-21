'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Toast } from '@/components/ui'
import { NoPermission } from './AdminConfirm'
import { defaultSortOrderForNew, type SortableService } from '@/lib/services/new-service'
import s from './admin-v2.module.css'

const MODELS = [
  { value: 'sum', label: '항목 합산 — 고른 항목의 금액을 더한다' },
  { value: 'sumMultiplier', label: '항목 합산 + 기간 — 더한 뒤 광고 기간을 곱한다' },
  { value: 'tier', label: '등급 선택 — 등급별 정액' },
  { value: 'videoPairs', label: '종류 × 길이 — 영상 종류마다 길이를 고른다' },
  { value: 'inquiry', label: '문의형 — 금액 없이 문의만 받는다' },
] as const

/**
 * 새 광고 서비스 만들기(Figma [v3] 13-A 「새 서비스」). 목록 화면 위에 접었다 편다.
 *
 * 번호와 주소는 여기서 정하지 않는다 — 서버가 기존 최대 번호 다음을 주고, 주소는 이름에서 만든다.
 * 계산 방식은 만들 때만 고른다. 만든 뒤에는 바꾸지 못한다(이미 받은 주문과 금액이 어긋난다).
 */
export function NewServiceForm({ canEdit, existing }: { canEdit: boolean; existing: SortableService[] }) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [denied, setDenied] = useState(false)
  const [busy, setBusy] = useState(false)
  const [toast, setToast] = useState<{ kind: 'success' | 'error'; text: string } | null>(null)
  // 「기타」(model: 'inquiry') 뒤에 붙이면 항상 마지막이어야 할 「기타」가 마지막 자리를
  // 잃는다 — 그래서 기본값을 「기타」 바로 앞으로 준다(2026-09-19). 관리자가 고칠 수 있다
  const [form, setForm] = useState({
    nameKo: '',
    nameJa: '',
    model: 'sum' as (typeof MODELS)[number]['value'],
    contractMode: 'fixed' as 'fixed' | 'perQuote',
  })

  async function create() {
    if (!canEdit) return setDenied(true)
    if (!form.nameKo.trim() || !form.nameJa.trim()) {
      return setToast({ kind: 'error', text: '서비스 이름을 한국어·일본어 모두 적어 주세요.' })
    }
    setBusy(true)
    const res = await fetch('/api/admin/services', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        nameKo: form.nameKo.trim(),
        nameJa: form.nameJa.trim(),
        model: form.model,
        contractMode: form.contractMode,
        sortOrder: defaultSortOrderForNew(existing),
        // 새 서비스는 묶음·항목을 채운 뒤에 열어야 한다. 빈 화면이 고객에게 먼저 보이면 안 된다
        active: false,
      }),
    })
    setBusy(false)

    if (!res.ok) return setToast({ kind: 'error', text: '서비스를 만들지 못했습니다.' })
    const body = (await res.json()) as { id: number; no: number }
    router.push(`/manage/services/${body.id}`)
  }

  if (!open) {
    return (
      <>
        <div className={s.actions}>
          <button type="button" className={s.primaryBtn} onClick={() => (canEdit ? setOpen(true) : setDenied(true))}>
            새 서비스
          </button>
        </div>
        <NoPermission open={denied} onClose={() => setDenied(false)} />
      </>
    )
  }

  return (
    <>
      <section className={s.card}>
        <h2 className={s.cardTitle}>새 서비스</h2>
        <div className={s.formGrid}>
          <label className={s.field}>
            <span>서비스 이름 (한국어)</span>
            <input
              value={form.nameKo}
              onChange={(e) => setForm({ ...form, nameKo: e.target.value })}
              placeholder="6. 옥외 전광판 광고"
            />
          </label>
          <label className={s.field}>
            <span>서비스 이름 (일본어)</span>
            <input
              value={form.nameJa}
              onChange={(e) => setForm({ ...form, nameJa: e.target.value })}
              placeholder="屋外電光掲示板広告"
            />
          </label>
          <label className={s.field}>
            <span>계산 방식 (나중에 못 바꿉니다)</span>
            <select
              value={form.model}
              onChange={(e) => setForm({ ...form, model: e.target.value as typeof form.model })}
            >
              {MODELS.map((m) => (
                <option key={m.value} value={m.value}>
                  {m.label}
                </option>
              ))}
            </select>
          </label>
          <label className={s.field}>
            <span>계약서</span>
            <select
              value={form.contractMode}
              onChange={(e) => setForm({ ...form, contractMode: e.target.value as 'fixed' | 'perQuote' })}
            >
              <option value="fixed">고정 계약서</option>
              <option value="perQuote">견적 발행 때마다 작성</option>
            </select>
          </label>
        </div>
        <p className={s.note}>
          번호·주소·순서는 저장할 때 자동으로 정해집니다(순서는 목록 화면에서 위·아래 버튼으로 바꿉니다). 만든 서비스는 비공개로 시작하니, 묶음과 항목을 채운 뒤 공개로 바꾸세요.
        </p>
        <div className={s.actions}>
          <button type="button" className={s.primaryBtn} onClick={create} disabled={busy}>
            만들고 편집하기
          </button>
          <button type="button" className={s.ghostBtn} onClick={() => setOpen(false)} disabled={busy}>
            취소
          </button>
        </div>
      </section>
      <NoPermission open={denied} onClose={() => setDenied(false)} />
      {toast ? <Toast kind={toast.kind} message={toast.text} closeLabel="닫기" onClose={() => setToast(null)} /> : null}
    </>
  )
}
