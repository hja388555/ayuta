'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Toast } from '@/components/ui'
import { NoPermission } from './AdminConfirm'
import s from './admin-v2.module.css'

export type ServiceRow = {
  id: number
  no: number
  slug: string
  nameKo: string
  nameJa: string
  contractMode: 'fixed' | 'perQuote'
  model: string
  active: boolean
  sortOrder: number
  groupCount: number
}

const MODEL_LABELS: Record<string, string> = {
  tier: '등급 선택',
  sum: '항목 합산',
  sumMultiplier: '항목 합산 + 기간',
  videoPairs: '종류 × 길이',
  inquiry: '문의형',
}

const CONTRACT_LABELS: Record<string, string> = {
  fixed: '고정 계약서',
  perQuote: '견적 발행 때 작성',
}

/**
 * 광고 서비스 목록 + 순서 바꾸기(Figma [v3] 13-A).
 *
 * 순서는 숫자를 적는 대신 위/아래 버튼으로 바꾼다. 화면에 보이는 순서가 곧 메인·주문 화면 순서라
 * 관리자가 숫자 체계(10, 20, 30…)를 알 필요가 없다. 누르면 이웃과 sortOrder 값을 맞바꿔 두 줄을
 * 바로 저장한다 — 목록에는 저장 버튼이 없으므로 미뤄 둘 곳이 없다.
 */
export function ServiceOrderList({ rows, canEdit }: { rows: ServiceRow[]; canEdit: boolean }) {
  const router = useRouter()
  const [list, setList] = useState(rows)
  const [busy, setBusy] = useState(false)
  const [denied, setDenied] = useState(false)
  const [toast, setToast] = useState<{ kind: 'success' | 'error'; text: string } | null>(null)

  useEffect(() => setList(rows), [rows])

  async function move(index: number, delta: -1 | 1) {
    if (!canEdit) return setDenied(true)
    const other = index + delta
    if (busy || other < 0 || other >= list.length) return

    const a = list[index]
    const b = list[other]
    if (!a || !b) return
    // 두 줄의 sortOrder 가 같으면(옛 자료) 맞바꿔도 자리가 안 바뀐다 — 이럴 때만 새 값을 준다
    const [orderA, orderB] = a.sortOrder === b.sortOrder ? [b.sortOrder + delta, b.sortOrder] : [b.sortOrder, a.sortOrder]

    const next = [...list]
    next[index] = { ...b, sortOrder: orderB }
    next[other] = { ...a, sortOrder: orderA }
    setList(next)

    setBusy(true)
    const results = await Promise.all([save({ ...a, sortOrder: orderA }), save({ ...b, sortOrder: orderB })])
    setBusy(false)
    if (results.some((ok) => !ok)) {
      setList(list)
      return setToast({ kind: 'error', text: '순서를 저장하지 못했습니다.' })
    }
    router.refresh()
  }

  return (
    <>
      <section className={s.card}>
        {list.map((d, idx) => (
          <div key={d.id} className={`${s.listRow} ${s.listRowLine}`}>
            <div className={s.orderBtns}>
              <button
                type="button"
                className={s.orderBtn}
                onClick={() => move(idx, -1)}
                disabled={busy || idx === 0}
                aria-label={`${d.nameKo} 위로`}
              >
                ▲
              </button>
              <button
                type="button"
                className={s.orderBtn}
                onClick={() => move(idx, 1)}
                disabled={busy || idx === list.length - 1}
                aria-label={`${d.nameKo} 아래로`}
              >
                ▼
              </button>
            </div>
            <div className={s.listMain}>
              {/* 이름에 이미 번호가 들어 있다("1. 디지털/SNS광고") — 화면에서 또 붙이면 겹친다.
                  이름이 정본이므로 관리자가 고친 그대로 보여 준다 */}
              <Link className={s.listLink} href={`/manage/services/${d.id}`}>
                {d.nameKo}
              </Link>
              <p className={s.hint}>
                {d.no}번 · {MODEL_LABELS[d.model] ?? d.model} · {CONTRACT_LABELS[d.contractMode] ?? d.contractMode} · 묶음{' '}
                {d.groupCount}개 · /order/{d.slug}
              </p>
            </div>
            <span className={s.pillGray}>{d.active ? '공개' : '비공개'}</span>
          </div>
        ))}
      </section>
      <NoPermission open={denied} onClose={() => setDenied(false)} />
      {toast ? <Toast kind={toast.kind} message={toast.text} closeLabel="닫기" onClose={() => setToast(null)} /> : null}
    </>
  )
}

async function save(row: ServiceRow): Promise<boolean> {
  const res = await fetch('/api/admin/services', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      id: row.id,
      nameKo: row.nameKo,
      nameJa: row.nameJa,
      contractMode: row.contractMode,
      sortOrder: row.sortOrder,
      active: row.active,
    }),
  })
  return res.ok
}
