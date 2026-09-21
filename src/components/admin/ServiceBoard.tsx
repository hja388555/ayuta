'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { adminErrorMessage } from '@/lib/admin/error-messages'
import { priceAmountProblem } from '@/lib/admin/price-limits'
import { Toast } from '@/components/ui'
import { AdminConfirm, NoPermission } from './AdminConfirm'
import s from './admin-v2.module.css'

export type ItemRow = {
  id: number
  key: string
  labelKo: string
  labelJa: string
  priceKrw: number
  priceJpy: number
  priced: boolean
  exclusive: boolean
  country: 'kr' | 'jp' | null
  sortOrder: number
  active: boolean
}

export type GroupCard = {
  id: number
  key: string
  titleKo: string
  titleJa: string
  multi: boolean
  countryTabs: boolean
  axis: 'none' | 'type' | 'length'
  sortOrder: number
  active: boolean
  items: ItemRow[]
}

export type ServiceInfo = {
  id: number
  no: number
  slug: string
  nameKo: string
  nameJa: string
  descKo: string
  descJa: string
  model: string
  contractMode: 'fixed' | 'perQuote'
  sortOrder: number
  active: boolean
}

const MODEL_LABELS: Record<string, string> = {
  tier: '등급 선택',
  sum: '항목 합산',
  sumMultiplier: '항목 합산 + 기간',
  videoPairs: '종류 × 길이',
  inquiry: '문의형',
}

/**
 * 광고 서비스 편집 본문(Figma [v3] 13-B). 기본 정보 한 칸, 그 아래 묶음 카드가 쌓인다.
 *
 * 저장은 바뀐 줄만 골라 관리자 API 를 차례로 부른다(단가 화면과 같다 — 배치 API 는 없다).
 * 번호·주소·계산 방식은 화면에 보이되 고치지 못한다. 셋 다 이미 받은 주문과 계약서가
 * 서로를 찾는 이름이라, 바뀌면 옛 주문이 조용히 다른 서비스를 가리킨다.
 */
export function ServiceBoard({
  service,
  groups,
  canEdit,
}: {
  service: ServiceInfo
  groups: GroupCard[]
  canEdit: boolean
}) {
  const router = useRouter()
  const [info, setInfo] = useState({
    nameKo: service.nameKo,
    nameJa: service.nameJa,
    descKo: service.descKo,
    descJa: service.descJa,
    contractMode: service.contractMode,
    active: service.active,
  })
  const [cards, setCards] = useState(groups)

  // 묶음·항목을 추가하면 서버에서 다시 읽어 온다(router.refresh). useState 는 최초 값만 잡으므로
  // 새로 받은 목록을 여기서 화면에 반영해야 방금 만든 줄이 보인다
  useEffect(() => setCards(groups), [groups])
  const [confirm, setConfirm] = useState(false)
  const [denied, setDenied] = useState(false)
  const [busy, setBusy] = useState(false)
  const [toast, setToast] = useState<{ kind: 'success' | 'error'; text: string } | null>(null)

  function patchItem(groupId: number, itemId: number, patch: Partial<ItemRow>) {
    setCards((prev) =>
      prev.map((g) =>
        g.id === groupId ? { ...g, items: g.items.map((i) => (i.id === itemId ? { ...i, ...patch } : i)) } : g,
      ),
    )
  }

  /**
   * 항목 순서 바꾸기. 이웃과 sortOrder 값을 맞바꾸고 그 순서대로 다시 늘어놓는다 —
   * 화면 순서와 저장될 값이 늘 같다. 저장은 아래 「저장」 버튼이 바뀐 줄만 보낸다.
   */
  function moveItem(groupId: number, itemId: number, delta: -1 | 1) {
    if (!canEdit) return setDenied(true)
    setCards((prev) =>
      prev.map((g) => {
        if (g.id !== groupId) return g
        const at = g.items.findIndex((i) => i.id === itemId)
        const other = at + delta
        if (at < 0 || other < 0 || other >= g.items.length) return g
        const items = [...g.items]
        const a = items[at]
        const b = items[other]
        if (!a || !b) return g
        // 값이 같으면(옛 자료) 맞바꿔도 자리가 그대로다 — 그때만 새 값을 만든다
        const [orderA, orderB] = a.sortOrder === b.sortOrder ? [b.sortOrder + delta, b.sortOrder] : [b.sortOrder, a.sortOrder]
        items[at] = { ...b, sortOrder: orderB }
        items[other] = { ...a, sortOrder: orderA }
        return { ...g, items: items.sort((x, y) => x.sortOrder - y.sortOrder) }
      }),
    )
  }

  function patchGroup(groupId: number, patch: Partial<GroupCard>) {
    setCards((prev) => prev.map((g) => (g.id === groupId ? { ...g, ...patch } : g)))
  }

  /**
   * 묶음·항목 추가는 저장을 기다리지 않고 바로 만든다.
   *
   * 빈 줄을 화면에만 띄워 두면 그 줄의 id 가 없어 「바뀐 줄만 보낸다」는 저장 규칙에 걸리고,
   * 항목은 서버가 키를 만들어야 해서 어차피 한 번은 서버에 다녀와야 한다. 만들자마자
   * 서버 값(id·키)을 받아 화면에 꽂아 두면 이후 편집은 기존 줄과 똑같이 흐른다.
   */
  async function addGroup() {
    if (!canEdit) return setDenied(true)
    setBusy(true)
    const order = (cards.at(-1)?.sortOrder ?? 0) + 10
    const res = await fetch('/api/admin/service-groups', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        serviceId: service.id,
        key: `g${Date.now().toString(36)}`,
        titleKo: '새 묶음',
        titleJa: '新しいグループ',
        multi: false,
        countryTabs: false,
        axis: 'none',
        sortOrder: order,
        active: true,
      }),
    })
    setBusy(false)
    if (!res.ok) return setToast({ kind: 'error', text: '묶음을 만들지 못했습니다.' })
    router.refresh()
  }

  async function addItem(groupId: number) {
    if (!canEdit) return setDenied(true)
    const card = cards.find((g) => g.id === groupId)
    setBusy(true)
    const res = await fetch('/api/admin/service-items', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        groupId,
        labelKo: '새 항목',
        labelJa: '新しい項目',
        priceKrw: 0,
        priceJpy: 0,
        priced: true,
        exclusive: false,
        sortOrder: (card?.items.at(-1)?.sortOrder ?? 0) + 10,
        active: true,
      }),
    })
    setBusy(false)
    if (!res.ok) return setToast({ kind: 'error', text: '항목을 만들지 못했습니다.' })
    router.refresh()
  }

  function askSave() {
    if (!canEdit) return setDenied(true)
    if (!info.nameKo.trim() || !info.nameJa.trim()) return setToast({ kind: 'error', text: '서비스 이름을 한국어·일본어 모두 적어 주세요.' })

    for (const g of cards) {
      for (const i of g.items) {
        if (!i.labelKo.trim() || !i.labelJa.trim()) {
          return setToast({ kind: 'error', text: `${g.titleKo}: 항목 이름을 한국어·일본어 모두 적어 주세요.` })
        }
        for (const [name, raw] of [['원화', i.priceKrw], ['엔화', i.priceJpy]] as const) {
          const problem = priceAmountProblem(String(raw))
          if (problem) {
            const code = problem === 'too_large' ? 'price_too_large' : 'price_failed'
            return setToast({ kind: 'error', text: `${i.labelKo} ${name}: ${adminErrorMessage(code)}` })
          }
        }
      }
    }
    setConfirm(true)
  }

  async function save() {
    setBusy(true)
    const failed: string[] = []

    const infoRes = await fetch('/api/admin/services', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        id: service.id,
        nameKo: info.nameKo.trim(),
        nameJa: info.nameJa.trim(),
        ...(info.descKo.trim() ? { descKo: info.descKo.trim() } : {}),
        ...(info.descJa.trim() ? { descJa: info.descJa.trim() } : {}),
        contractMode: info.contractMode,
        sortOrder: service.sortOrder,
        active: info.active,
      }),
    })
    if (!infoRes.ok) failed.push('기본 정보')

    for (const g of cards) {
      const before = groups.find((x) => x.id === g.id)
      const groupChanged =
        before &&
        (before.titleKo !== g.titleKo ||
          before.titleJa !== g.titleJa ||
          before.multi !== g.multi ||
          before.countryTabs !== g.countryTabs ||
          before.sortOrder !== g.sortOrder ||
          before.active !== g.active)
      if (groupChanged) {
        const res = await fetch('/api/admin/service-groups', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({
            id: g.id,
            titleKo: g.titleKo.trim(),
            titleJa: g.titleJa.trim(),
            multi: g.multi,
            countryTabs: g.countryTabs,
            axis: g.axis,
            sortOrder: g.sortOrder,
            active: g.active,
          }),
        })
        if (!res.ok) failed.push(g.titleKo)
      }

      for (const i of g.items) {
        const was = before?.items.find((x) => x.id === i.id)
        const itemChanged =
          was &&
          (was.labelKo !== i.labelKo ||
            was.labelJa !== i.labelJa ||
            was.priceKrw !== i.priceKrw ||
            was.priceJpy !== i.priceJpy ||
            was.sortOrder !== i.sortOrder ||
            was.active !== i.active)
        if (!itemChanged) continue
        const res = await fetch('/api/admin/service-items', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({
            id: i.id,
            labelKo: i.labelKo.trim(),
            labelJa: i.labelJa.trim(),
            priceKrw: i.priceKrw,
            priceJpy: i.priceJpy,
            priced: i.priced,
            exclusive: i.exclusive,
            ...(i.country ? { country: i.country } : {}),
            sortOrder: i.sortOrder,
            active: i.active,
          }),
        })
        if (!res.ok) failed.push(i.labelKo)
      }
    }

    setBusy(false)
    setConfirm(false)
    if (failed.length > 0) {
      setToast({ kind: 'error', text: `저장하지 못한 항목: ${failed.join(', ')}` })
      return
    }
    setToast({ kind: 'success', text: '저장했습니다.' })
    router.refresh()
  }

  return (
    <>
      <section className={s.card}>
        <h2 className={s.cardTitle}>기본 정보</h2>
        <div className={s.formGrid}>
          <label className={s.field}>
            <span>서비스 이름 (한국어)</span>
            <input value={info.nameKo} onChange={(e) => setInfo({ ...info, nameKo: e.target.value })} disabled={!canEdit} />
          </label>
          <label className={s.field}>
            <span>서비스 이름 (일본어)</span>
            <input value={info.nameJa} onChange={(e) => setInfo({ ...info, nameJa: e.target.value })} disabled={!canEdit} />
          </label>
          <label className={s.field}>
            <span>계산 방식</span>
            <input value={MODEL_LABELS[service.model] ?? service.model} readOnly disabled />
          </label>
          <label className={s.field}>
            <span>계약서</span>
            <select
              value={info.contractMode}
              onChange={(e) => setInfo({ ...info, contractMode: e.target.value as 'fixed' | 'perQuote' })}
              disabled={!canEdit}
            >
              <option value="fixed">고정 계약서</option>
              <option value="perQuote">견적 발행 때마다 작성</option>
            </select>
          </label>
          <label className={s.field}>
            <span>순서</span>
            <input value={`${service.sortOrder}번째`} readOnly disabled />
            <span className={s.fieldHint}>목록 화면에서 위·아래 버튼으로 바꿉니다.</span>
          </label>
          <label className={s.field}>
            <span>주소 (자동 생성)</span>
            <input value={`/order/${service.slug}`} readOnly disabled />
          </label>
          <label className={s.field}>
            <span>공개 여부</span>
            <select
              value={info.active ? 'on' : 'off'}
              onChange={(e) => setInfo({ ...info, active: e.target.value === 'on' })}
              disabled={!canEdit}
            >
              <option value="on">공개</option>
              <option value="off">비공개</option>
            </select>
          </label>
        </div>
      </section>

      {cards.map((g, idx) => (
        <section key={g.id} className={s.card}>
          <div className={s.cardHead}>
            <h2 className={s.cardTitle}>
              묶음 {idx + 1} — {g.titleKo}
            </h2>
            <div className={s.cardTags}>
              <span className={g.multi ? s.pillOn : s.pillGray}>{g.multi ? '중복 선택' : '하나만 선택'}</span>
              {g.countryTabs ? <span className={s.pillOn}>한국/일본 탭</span> : null}
              <span className={g.active ? s.pillGray : s.pillOff}>{g.active ? '사용' : '숨김'}</span>
            </div>
          </div>

          {g.items.length === 0 ? (
            <p className={s.note}>이 묶음에는 항목이 없습니다.</p>
          ) : (
            <div className={s.tableWrap}>
              <table className={s.table}>
                <thead>
                  <tr>
                    <th>항목 이름 (한국어)</th>
                    <th>항목 이름 (일본어)</th>
                    <th>원화 단가</th>
                    <th>엔화 단가</th>
                    <th>순서</th>
                    <th>사용</th>
                  </tr>
                </thead>
                <tbody>
                  {g.items.map((i) => (
                    <tr key={i.id}>
                      <td>
                        <input
                          value={i.labelKo}
                          onChange={(e) => patchItem(g.id, i.id, { labelKo: e.target.value })}
                          disabled={!canEdit}
                        />
                      </td>
                      <td>
                        <input
                          value={i.labelJa}
                          onChange={(e) => patchItem(g.id, i.id, { labelJa: e.target.value })}
                          disabled={!canEdit}
                        />
                      </td>
                      <td>
                        <input
                          inputMode="numeric"
                          value={String(i.priceKrw)}
                          onChange={(e) => patchItem(g.id, i.id, { priceKrw: Number(e.target.value) || 0 })}
                          disabled={!canEdit || !i.priced}
                        />
                      </td>
                      <td>
                        <input
                          inputMode="numeric"
                          value={String(i.priceJpy)}
                          onChange={(e) => patchItem(g.id, i.id, { priceJpy: Number(e.target.value) || 0 })}
                          disabled={!canEdit || !i.priced}
                        />
                      </td>
                      <td>
                        <div className={s.orderBtns}>
                          <button
                            type="button"
                            className={s.orderBtn}
                            onClick={() => moveItem(g.id, i.id, -1)}
                            disabled={!canEdit || g.items[0]?.id === i.id}
                            aria-label={`${i.labelKo} 위로`}
                          >
                            ▲
                          </button>
                          <button
                            type="button"
                            className={s.orderBtn}
                            onClick={() => moveItem(g.id, i.id, 1)}
                            disabled={!canEdit || g.items.at(-1)?.id === i.id}
                            aria-label={`${i.labelKo} 아래로`}
                          >
                            ▼
                          </button>
                        </div>
                      </td>
                      <td>
                        <select
                          value={i.active ? 'on' : 'off'}
                          onChange={(e) => patchItem(g.id, i.id, { active: e.target.value === 'on' })}
                          disabled={!canEdit}
                        >
                          <option value="on">사용</option>
                          <option value="off">숨김</option>
                        </select>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <button type="button" className={s.addRowBtn} onClick={() => addItem(g.id)} disabled={busy}>
            + 항목 추가
          </button>

          <label className={s.inlineCheck}>
            <input
              type="checkbox"
              checked={g.multi}
              onChange={(e) => patchGroup(g.id, { multi: e.target.checked })}
              disabled={!canEdit}
            />
            <span>이 묶음에서 여러 개를 고를 수 있게 한다</span>
          </label>

          <p className={s.note}>
            항목 키는 저장할 때 자동으로 만들어지고 이후 바뀌지 않습니다. 금액이 없는 선택지는 단가를 0 으로 두세요.
          </p>
        </section>
      ))}

      <button type="button" className={s.addRowBtn} onClick={addGroup} disabled={busy}>
        + 묶음 추가
      </button>

      <div className={s.actions}>
        <button type="button" className={s.primaryBtn} onClick={askSave} disabled={busy}>
          저장
        </button>
      </div>

      <AdminConfirm
        open={confirm}
        onClose={() => setConfirm(false)}
        onConfirm={save}
        title="광고 서비스를 저장할까요?"
        description="바뀐 내용이 메인과 주문 화면에 바로 반영됩니다."
        confirmLabel="저장"
        busy={busy}
      />
      <NoPermission open={denied} onClose={() => setDenied(false)} />
      {toast ? <Toast kind={toast.kind} message={toast.text} closeLabel="닫기" onClose={() => setToast(null)} /> : null}
    </>
  )
}
