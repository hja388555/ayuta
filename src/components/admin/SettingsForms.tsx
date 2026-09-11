'use client'

import { useState, type DragEvent } from 'react'
import { useRouter } from 'next/navigation'
import { adminErrorMessage } from '@/lib/admin/error-messages'
import { passwordIssue, PASSWORD_MIN } from '@/lib/password-policy'
import { Badge } from '@/components/ui'
import { AdminConfirm, NoPermission } from './AdminConfirm'
import s from './admin-v2.module.css'

type Msg = { ok: boolean; text: string } | null

function MsgLine({ msg }: { msg: Msg }) {
  if (!msg) return null
  return <p className={msg.ok ? s.ok : s.err}>{msg.text}</p>
}

async function postJson(url: string, body: unknown): Promise<Msg | true> {
  try {
    const res = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
    const json = await res.json().catch(() => ({}))
    if (!res.ok || !json?.ok) return { ok: false, text: adminErrorMessage(json?.error) }
    return true
  } catch {
    return { ok: false, text: adminErrorMessage('network') }
  }
}

type Company = {
  nameKo: string
  nameJa: string
  ceo: string
  businessNo: string
  addressKo: string
  addressJa: string
  phone: string
  email: string
  contactPhone: string
  mailOrderNo: string
}

// Figma A10 231:58 순서. 계약서에 일본어 상호·주소도 들어가므로 시안에 없는 (일본어) 칸을 짝으로 둔다
const LAYOUT: Array<Array<{ key: keyof Company; label: string; hint?: string }>> = [
  [
    { key: 'nameKo', label: '상호' },
    { key: 'nameJa', label: '상호 (일본어)' },
  ],
  [
    { key: 'ceo', label: '대표자' },
    { key: 'businessNo', label: '사업자등록번호' },
  ],
  [
    { key: 'phone', label: '대표번호' },
    { key: 'contactPhone', label: '담당자 연락처', hint: '비우면 푸터에서 빠집니다' },
  ],
  [{ key: 'addressKo', label: '사업장 주소' }],
  [{ key: 'addressJa', label: '사업장 주소 (일본어)' }],
  [{ key: 'mailOrderNo', label: '통신판매업 신고번호', hint: '비우면 푸터에서 빠집니다' }],
  [{ key: 'email', label: '대표 이메일' }],
]

/** 사업자 정보 — 계약서 을 정보 + 푸터. 저장하면 다음 계약서·견적서·푸터부터 반영된다 */
export function CompanyForm({ initial, canEdit }: { initial: Company; canEdit: boolean }) {
  const router = useRouter()
  const [v, setV] = useState(initial)
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState<Msg>(null)
  const [denied, setDenied] = useState(false)

  async function save() {
    if (!canEdit) return setDenied(true)
    if (busy) return
    setBusy(true)
    setMsg(null)
    const r = await postJson('/api/admin/settings', v)
    setBusy(false)
    if (r !== true) return setMsg(r)
    setMsg({ ok: true, text: '저장했습니다. 이미 체결된 계약서는 바뀌지 않습니다.' })
    router.refresh()
  }

  return (
    <>
      {LAYOUT.map((row) => (
        <div key={row.map((f) => f.key).join()} className={row.length > 1 ? s.pair : undefined}>
          {row.map((f) => (
            <label key={f.key} className={s.field}>
              <span>
                {f.label}
                {f.hint ? <span className={s.fieldHint}> · {f.hint}</span> : null}
              </span>
              <input className={s.input} value={v[f.key]} onChange={(e) => setV({ ...v, [f.key]: e.target.value })} readOnly={!canEdit} disabled={busy} />
            </label>
          ))}
        </div>
      ))}
      <button type="button" className={`btn btn-primary btn-block ${s.bigBtn}`} onClick={save} disabled={busy}>
        {busy ? '저장 중…' : '저장'}
      </button>
      <MsgLine msg={msg} />
      <NoPermission open={denied} onClose={() => setDenied(false)} />
    </>
  )
}

/** 대표자 서명·날인 — 끌어다 놓거나 파일 선택. 투명 배경 PNG 검사는 서버(/api/admin/settings/seal)가 한다 */
export function SealUploadForm({ hasSeal, canEdit }: { hasSeal: boolean; canEdit: boolean }) {
  const router = useRouter()
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState<Msg>(null)
  const [version, setVersion] = useState(0)
  const [over, setOver] = useState(false)
  const [denied, setDenied] = useState(false)

  async function upload(file: File | undefined) {
    if (!file || busy) return
    if (!canEdit) return setDenied(true)
    setBusy(true)
    setMsg(null)
    try {
      const fd = new FormData()
      fd.set('file', file)
      const res = await fetch('/api/admin/settings/seal', { method: 'POST', body: fd })
      const body = await res.json().catch(() => ({}))
      if (!res.ok || !body?.ok) return setMsg({ ok: false, text: adminErrorMessage(body?.error) })
      setMsg({ ok: true, text: '서명·날인 이미지를 바꿨습니다.' })
      setVersion((n) => n + 1)
      router.refresh()
    } catch {
      setMsg({ ok: false, text: adminErrorMessage('network') })
    } finally {
      setBusy(false)
    }
  }

  function onDrop(e: DragEvent) {
    e.preventDefault()
    setOver(false)
    void upload(e.dataTransfer.files?.[0])
  }

  return (
    <>
      <div
        className={over ? `${s.drop} ${s.dropOver}` : s.drop}
        onDragOver={(e) => {
          e.preventDefault()
          setOver(true)
        }}
        onDragLeave={() => setOver(false)}
        onDrop={onDrop}
      >
        {hasSeal || version > 0 ? (
          // 체크무늬 배경 위에 보여 투명 여부가 눈에 보이게 한다
          <span className={s.seal}>
            <img src={`/api/admin/settings/seal?v=${version}`} alt="등록된 대표자 서명·날인" style={{ maxWidth: 200, maxHeight: 96, display: 'block' }} />
          </span>
        ) : (
          <img src="/ui/admin-upload.svg" alt="" width={26} height={26} />
        )}
        <span className={s.dropMain}>{busy ? '올리는 중…' : '서명 또는 도장 이미지를 올려주세요'}</span>
        <span className={s.dropSub}>배경이 투명한 PNG (2MB 이하)</span>
      </div>
      <label className={`btn btn-secondary btn-block ${s.bigBtn}`} aria-disabled={busy} onClick={(e) => (canEdit ? undefined : (e.preventDefault(), setDenied(true)))}>
        파일 선택
        <input type="file" accept="image/png" hidden onChange={(e) => upload(e.target.files?.[0])} disabled={busy} />
      </label>
      <MsgLine msg={msg} />
      <NoPermission open={denied} onClose={() => setDenied(false)} />
    </>
  )
}

type Account = { id: number; email: string; name: string; role: string }

const roleLabel = (role: string) => (role === 'super' ? '최고관리자' : '중간관리자')

/**
 * 관리자 계정 목록·권한 변경·생성. accounts 가 null 이면(중간관리자) 목록 대신 권한 안내만 보여 준다.
 * 계정 생성은 A11 ⑥ 팝업. 시안은 "초대 메일 발송"이지만 메일 발송(Q28)이 아직 없어 비밀번호를 직접 정한다.
 */
export function AccountsManager({ accounts, meId }: { accounts: Account[] | null; meId: number }) {
  const router = useRouter()
  const empty = { email: '', name: '', password: '', role: 'manager' }
  const [form, setForm] = useState(empty)
  const [creating, setCreating] = useState(false)
  const [pending, setPending] = useState<{ account: Account; role: string } | null>(null)
  const [denied, setDenied] = useState(false)
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState<Msg>(null)
  const [formMsg, setFormMsg] = useState<Msg>(null)

  const canManage = accounts !== null
  const pwIssue = form.password ? passwordIssue(form.password) : null

  async function changeRole() {
    if (!pending) return
    setBusy(true)
    const r = await postJson('/api/admin/accounts/role', { userId: pending.account.id, role: pending.role })
    setBusy(false)
    setPending(null)
    setMsg(r === true ? { ok: true, text: '권한을 바꿨습니다.' } : r)
    if (r === true) router.refresh()
  }

  async function create() {
    if (pwIssue || form.password.length < PASSWORD_MIN) return setFormMsg({ ok: false, text: `비밀번호는 영문·숫자·기호를 모두 넣어 ${PASSWORD_MIN}자 이상으로 정해 주세요.` })
    setBusy(true)
    setFormMsg(null)
    const r = await postJson('/api/admin/accounts', form)
    setBusy(false)
    if (r !== true) return setFormMsg(r)
    setCreating(false)
    setForm(empty)
    setMsg({ ok: true, text: '계정을 만들었습니다. 비밀번호는 본인에게 따로 전달해 주세요.' })
    router.refresh()
  }

  const pendingText = pending
    ? pending.role === 'customer'
      ? `${pending.account.email} 의 관리자 권한을 해제할까요?\n일반 회원으로 바뀌며 관리자 화면에 들어올 수 없게 됩니다.`
      : `${pending.account.email} 의 권한을 ${roleLabel(pending.role)}(으)로 바꿀까요?`
    : ''

  return (
    <>
      {(accounts ?? []).map((a) => (
        <div key={a.id} className={s.listRow}>
          <div className={s.listMain}>
            <strong>{a.email}</strong>
            {a.name ? <span className={s.fieldHint}> · {a.name}</span> : null}
          </div>
          {a.id === meId ? (
            <Badge tone={a.role === 'super' ? 'danger' : 'neutral'}>{roleLabel(a.role)} (나)</Badge>
          ) : (
            <>
              <select
                className={s.select}
                aria-label={`${a.email} 권한`}
                value={a.role}
                disabled={busy}
                onChange={(e) => setPending({ account: a, role: e.target.value })}
              >
                <option value="super">최고관리자</option>
                <option value="manager">중간관리자</option>
              </select>
              <button type="button" className="btn btn-outline" style={{ width: 32, height: 32, padding: 0 }} aria-label={`${a.email} 관리자 권한 해제`} disabled={busy} onClick={() => setPending({ account: a, role: 'customer' })}>
                <img src="/ui/admin-trash.svg" alt="" width={16} height={16} />
              </button>
            </>
          )}
        </div>
      ))}
      <button type="button" className={`btn btn-outline btn-block ${s.bigBtn}`} onClick={() => (canManage ? (setFormMsg(null), setCreating(true)) : setDenied(true))}>
        + 관리자 추가
      </button>
      <p className={s.note}>중간관리자는 환불 승인 · 단가 관리 · 설정 저장을 할 수 없습니다.</p>
      <MsgLine msg={msg} />

      <AdminConfirm
        open={creating}
        onClose={() => setCreating(false)}
        onConfirm={create}
        busy={busy}
        confirmDisabled={!form.email || !form.password}
        confirmLabel="계정 생성"
        title="관리자 계정을 만들까요?"
        description={'초대 메일 발송은 준비 중이라(Q28) 비밀번호를 직접 정해 전달해 주세요.\n권한은 나중에 변경하실 수 있습니다.'}
      >
        <input className={s.input} placeholder="이메일" type="email" aria-label="이메일" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
        <input className={s.input} placeholder="이름" aria-label="이름" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
        <input className={s.input} placeholder="초기 비밀번호" type="password" autoComplete="new-password" aria-label="초기 비밀번호" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} />
        <span className={s.fieldHint} style={pwIssue ? { color: '#d92d20' } : undefined}>
          영문·숫자·기호를 모두 넣어 {PASSWORD_MIN}자 이상
        </span>
        <div className={s.radios} role="radiogroup" aria-label="권한">
          {(['manager', 'super'] as const).map((r) => (
            <label key={r} className={form.role === r ? `${s.radio} ${s.radioOn}` : s.radio}>
              <input type="radio" name="new-admin-role" checked={form.role === r} onChange={() => setForm({ ...form, role: r })} />
              {roleLabel(r)}
            </label>
          ))}
        </div>
        <MsgLine msg={formMsg} />
      </AdminConfirm>
      <AdminConfirm open={pending !== null} onClose={() => setPending(null)} onConfirm={changeRole} busy={busy} tone={pending?.role === 'customer' ? 'danger' : 'brand'} confirmLabel="변경" title="권한을 바꿀까요?" description={pendingText} />
      <NoPermission open={denied} onClose={() => setDenied(false)} />
    </>
  )
}

const MAIL_EVENTS = [
  { label: '새 주문이 들어왔을 때', on: true },
  { label: '환불이 신청되었을 때', on: true },
  { label: '기타 광고 문의가 접수되었을 때', on: true },
  { label: '1:1 채팅이 도착했을 때', on: false },
]

/** 알림 메일 — 메일 발송(Q28)이 아직 없어 시안 모양만 잠가 둔다. 저장할 스키마도 없다 */
export function NotifyMailCard({ email }: { email: string }) {
  return (
    <>
      <p className={s.warn}>메일 발송 기능(Q28) 이후 사용할 수 있습니다.</p>
      <div className={s.disabledBlock} aria-disabled="true" style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
        {MAIL_EVENTS.map((m) => (
          <div key={m.label} className={`${s.listRow} ${s.listRowLine}`}>
            <span className={s.listMain}>{m.label}</span>
            <span className={m.on ? `${s.switch} ${s.switchOn}` : s.switch} role="switch" aria-checked={m.on} aria-label={m.label} />
          </div>
        ))}
        <label className={s.field}>
          수신 이메일
          <input className={s.input} value={email} readOnly disabled />
        </label>
        <button type="button" className={`btn btn-primary btn-block ${s.bigBtn}`} disabled>
          저장
        </button>
      </div>
    </>
  )
}
