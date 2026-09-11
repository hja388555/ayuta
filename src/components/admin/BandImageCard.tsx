'use client'

import { useRef, useState, type DragEvent } from 'react'
import { useRouter } from 'next/navigation'
import { adminErrorMessage } from '@/lib/admin/error-messages'
import { Badge } from '@/components/ui'
import { AdminConfirm, NoPermission } from './AdminConfirm'
import s from './admin-v2.module.css'

/**
 * A6 서비스 카드 하나 — 미리보기(끌어다 놓기·클릭 업로드) + [교체]/[이미지 올리기] + [삭제].
 * 삭제는 A11 ④ 확인 → ⑤ DELETE 입력 후 완전 삭제(파일까지 지워 되돌릴 수 없다).
 * 형식·크기·권한 판정은 서버(/api/admin/images/[slot])가 한다.
 */
export function BandImageCard({ slot, title, version, canEdit }: { slot: string; title: string; version: string | null; canEdit: boolean }) {
  const router = useRouter()
  const input = useRef<HTMLInputElement>(null)
  const [busy, setBusy] = useState(false)
  const [over, setOver] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [denied, setDenied] = useState(false)
  const [step, setStep] = useState<'none' | 'confirm' | 'type'>('none')
  const [typed, setTyped] = useState('')
  const registered = version !== null

  const guard = () => {
    if (canEdit) return true
    setDenied(true)
    return false
  }

  async function send(method: 'POST' | 'DELETE', file?: File) {
    setBusy(true)
    setError(null)
    try {
      let body: FormData | undefined
      if (file) {
        body = new FormData()
        body.set('file', file)
      }
      const res = await fetch(`/api/admin/images/${slot}`, { method, body })
      const json = await res.json().catch(() => ({}))
      if (!res.ok || !json?.ok) {
        setError(adminErrorMessage(json?.error))
        return false
      }
      router.refresh()
      return true
    } catch {
      setError(adminErrorMessage('network'))
      return false
    } finally {
      setBusy(false)
    }
  }

  function upload(file: File | undefined) {
    if (!file || busy || !guard()) return
    void send('POST', file)
  }

  function openPicker() {
    if (busy || !guard()) return
    input.current?.click()
  }

  function onDrop(e: DragEvent) {
    e.preventDefault()
    setOver(false)
    upload(e.dataTransfer.files?.[0])
  }

  async function remove() {
    if (await send('DELETE')) closeDelete()
  }

  function closeDelete() {
    setStep('none')
    setTyped('')
  }

  return (
    <section className={s.bandCard} aria-label={title}>
      <div className={s.cardHead}>
        <h2 className={s.bandTitle}>{title}</h2>
        <Badge tone={registered ? 'success' : 'warning'}>{registered ? '등록됨' : '미등록'}</Badge>
      </div>

      <button
        type="button"
        className={[s.bandPreview, registered ? '' : s.bandEmpty, over ? s.dropOver : ''].join(' ')}
        onClick={openPicker}
        onDragOver={(e) => {
          e.preventDefault()
          setOver(true)
        }}
        onDragLeave={() => setOver(false)}
        onDrop={onDrop}
        disabled={busy}
        aria-label={registered ? `${title} 이미지 교체` : `${title} 이미지 올리기`}
      >
        {registered ? (
          <img className={s.bandThumb} src={`/api/band-image/${slot}?v=${encodeURIComponent(version)}`} alt="현재 이미지" />
        ) : (
          <>
            <img src="/ui/admin-upload.svg" alt="" width={26} height={26} className={s.bandIcon} />
            <span className={s.bandHint}>{busy ? '올리는 중…' : '이미지를 끌어다 놓거나 클릭해서 올려주세요'}</span>
          </>
        )}
      </button>
      <input ref={input} type="file" accept="image/jpeg,image/png,image/webp" hidden onChange={(e) => (upload(e.target.files?.[0]), (e.target.value = ''))} />

      <div className={s.bandBtns}>
        <button type="button" className={`btn btn-secondary ${s.bigBtn} ${s.bandMain}`} onClick={openPicker} disabled={busy}>
          {busy ? '처리 중…' : registered ? '교체' : '이미지 올리기'}
        </button>
        {registered ? (
          <button type="button" className={`btn btn-outline ${s.bigBtn} ${s.bandDelete}`} onClick={() => guard() && setStep('confirm')} disabled={busy}>
            <img src="/ui/admin-trash.svg" alt="" width={18} height={18} />
            삭제
          </button>
        ) : null}
      </div>
      {error ? <p className={s.err} role="alert">{error}</p> : null}

      <AdminConfirm
        open={step === 'confirm'}
        onClose={closeDelete}
        onConfirm={() => setStep('type')}
        tone="danger"
        title="이미지를 삭제할까요?"
        description="삭제하시면 해당 광고 서비스 페이지에 이미지가 표시되지 않습니다."
        confirmLabel="삭제"
      />
      <AdminConfirm
        open={step === 'type'}
        onClose={closeDelete}
        onConfirm={remove}
        tone="danger"
        title="완전히 삭제할까요?"
        description={'이 작업은 되돌릴 수 없습니다.\n삭제하시려면 아래에 DELETE를 입력해 주세요.'}
        confirmLabel="완전 삭제"
        busy={busy}
        confirmDisabled={typed !== 'DELETE'}
      >
        <input className={s.input} value={typed} onChange={(e) => setTyped(e.target.value)} placeholder="DELETE" aria-label="DELETE 입력" autoComplete="off" />
      </AdminConfirm>
      <NoPermission open={denied} onClose={() => setDenied(false)} />
    </section>
  )
}
