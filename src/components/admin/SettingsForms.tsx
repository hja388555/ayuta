'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { adminErrorMessage } from '@/lib/admin/error-messages'
import { button, errorBox, input } from './styles'

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

const FIELDS: Array<{ key: keyof Company; label: string; optional?: boolean }> = [
  { key: 'nameKo', label: '상호 (한국어)' },
  { key: 'nameJa', label: '상호 (일본어)' },
  { key: 'ceo', label: '대표자' },
  { key: 'businessNo', label: '사업자등록번호' },
  { key: 'addressKo', label: '사업장 주소 (한국어)' },
  { key: 'addressJa', label: '사업장 주소 (일본어)' },
  { key: 'phone', label: '대표전화' },
  { key: 'email', label: '이메일' },
  { key: 'contactPhone', label: '담당자 연락처 (푸터)', optional: true },
  { key: 'mailOrderNo', label: '통신판매업 신고번호 (푸터)', optional: true },
]

/** 회사 정보 — 계약서 을 정보 6종 + 푸터 전용 2종. 저장하면 다음 계약서·견적서·푸터부터 반영된다 */
export function CompanyForm({ initial, canEdit }: { initial: Company; canEdit: boolean }) {
  const router = useRouter()
  const [v, setV] = useState(initial)
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null)

  async function save() {
    if (busy) return
    setBusy(true)
    setMsg(null)
    try {
      const res = await fetch('/api/admin/settings', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(v) })
      const body = await res.json().catch(() => ({}))
      if (!res.ok || !body?.ok) return setMsg({ ok: false, text: adminErrorMessage(body?.error) })
      setMsg({ ok: true, text: '저장했습니다. 이미 체결된 계약서는 바뀌지 않습니다.' })
      router.refresh()
    } catch {
      setMsg({ ok: false, text: adminErrorMessage('network') })
    } finally {
      setBusy(false)
    }
  }

  return (
    <div style={{ display: 'grid', gap: 10, maxWidth: 560 }}>
      {FIELDS.map((f) => (
        <label key={f.key} style={{ fontSize: 13 }}>
          {f.label}
          {f.optional ? <span style={{ color: '#767B85' }}> — 비우면 푸터에서 빠집니다</span> : null}
          <input style={{ ...input, display: 'block', width: '100%', marginTop: 4 }} value={v[f.key]} onChange={(e) => setV({ ...v, [f.key]: e.target.value })} disabled={!canEdit || busy} />
        </label>
      ))}
      {canEdit ? (
        <button type="button" style={button} onClick={save} disabled={busy}>
          {busy ? '저장 중…' : '저장'}
        </button>
      ) : null}
      {msg ? <p style={msg.ok ? { fontSize: 13, color: '#2E7D32', margin: 0 } : errorBox}>{msg.text}</p> : null}
    </div>
  )
}

/** 대표자 서명·날인 — 투명 배경 PNG 만. 올리면 미리보기가 바뀐다 */
export function SealUploadForm({ hasSeal, canEdit }: { hasSeal: boolean; canEdit: boolean }) {
  const router = useRouter()
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null)
  const [version, setVersion] = useState(0)

  async function upload(file: File | undefined) {
    if (!file || busy) return
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

  return (
    <div>
      {hasSeal || version > 0 ? (
        // 체크무늬 배경 위에 보여 투명 여부가 눈에 보이게 한다
        <div style={{ display: 'inline-block', padding: 8, background: 'repeating-conic-gradient(#eee 0% 25%, #fff 0% 50%) 0 0 / 16px 16px', border: '1px solid #D6D9DE' }}>
          <img src={`/api/admin/settings/seal?v=${version}`} alt="등록된 대표자 서명·날인" style={{ maxWidth: 200, maxHeight: 120, display: 'block' }} />
        </div>
      ) : (
        <p style={{ fontSize: 13, color: '#767B85' }}>아직 등록한 이미지가 없습니다.</p>
      )}
      {canEdit ? (
        <label style={{ display: 'block', marginTop: 8, fontSize: 13 }}>
          투명 배경 PNG 올리기 (2MB 이하)
          <input type="file" accept="image/png" onChange={(e) => upload(e.target.files?.[0])} disabled={busy} style={{ display: 'block', marginTop: 4 }} />
        </label>
      ) : null}
      {msg ? <p style={msg.ok ? { fontSize: 13, color: '#2E7D32' } : errorBox}>{msg.text}</p> : null}
    </div>
  )
}

type Account = { id: number; email: string; name: string; role: string }

/** 관리자 계정 목록·권한 변경·생성 — 최고관리자만 */
export function AccountsManager({ accounts, meId }: { accounts: Account[]; meId: number }) {
  const router = useRouter()
  const [form, setForm] = useState({ email: '', name: '', password: '', role: 'manager' })
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null)

  async function call(url: string, body: unknown, okText: string) {
    if (busy) return false
    setBusy(true)
    setMsg(null)
    try {
      const res = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
      const json = await res.json().catch(() => ({}))
      if (!res.ok || !json?.ok) {
        setMsg({ ok: false, text: adminErrorMessage(json?.error) })
        return false
      }
      setMsg({ ok: true, text: okText })
      router.refresh()
      return true
    } catch {
      setMsg({ ok: false, text: adminErrorMessage('network') })
      return false
    } finally {
      setBusy(false)
    }
  }

  return (
    <div>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13, marginBottom: 16 }}>
        <thead>
          <tr>
            <th style={{ textAlign: 'left', padding: 4 }}>이메일</th>
            <th style={{ textAlign: 'left', padding: 4 }}>이름</th>
            <th style={{ textAlign: 'left', padding: 4 }}>권한</th>
          </tr>
        </thead>
        <tbody>
          {accounts.map((a) => (
            <tr key={a.id}>
              <td style={{ padding: 4 }}>{a.email}</td>
              <td style={{ padding: 4 }}>{a.name}</td>
              <td style={{ padding: 4 }}>
                {a.id === meId ? (
                  <span>{a.role === 'super' ? '최고관리자' : '중간관리자'} (나)</span>
                ) : (
                  <select
                    style={input}
                    defaultValue={a.role}
                    disabled={busy}
                    onChange={(e) => {
                      const role = e.target.value
                      const label = role === 'customer' ? '일반 회원(관리자 권한 해제)' : role === 'super' ? '최고관리자' : '중간관리자'
                      if (!window.confirm(`${a.email} 의 권한을 ${label}(으)로 바꿀까요?`)) {
                        e.target.value = a.role
                        return
                      }
                      void call('/api/admin/accounts/role', { userId: a.id, role }, '권한을 바꿨습니다.')
                    }}
                  >
                    <option value="super">최고관리자</option>
                    <option value="manager">중간관리자</option>
                    <option value="customer">권한 해제</option>
                  </select>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      <h3 style={{ fontSize: 14, margin: '0 0 8px' }}>관리자 계정 만들기</h3>
      <div style={{ display: 'grid', gap: 8, maxWidth: 420 }}>
        <input style={input} placeholder="이메일" type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} disabled={busy} />
        <input style={input} placeholder="이름" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} disabled={busy} />
        <input style={input} placeholder="비밀번호 (10자 이상)" type="password" autoComplete="new-password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} disabled={busy} />
        <select style={input} value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })} disabled={busy}>
          <option value="manager">중간관리자</option>
          <option value="super">최고관리자</option>
        </select>
        <button
          type="button"
          style={button}
          disabled={busy}
          onClick={async () => {
            if (form.password.length < 10) return setMsg({ ok: false, text: adminErrorMessage('password_too_short') })
            if (await call('/api/admin/accounts', form, '계정을 만들었습니다. 비밀번호는 본인에게 따로 전달해 주세요.')) setForm({ email: '', name: '', password: '', role: 'manager' })
          }}
        >
          계정 만들기
        </button>
      </div>
      {msg ? <p style={msg.ok ? { fontSize: 13, color: '#2E7D32' } : errorBox}>{msg.text}</p> : null}
    </div>
  )
}
