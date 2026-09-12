'use client'

import { useEffect, useRef, type ReactNode } from 'react'
import s from './admin-v2.module.css'

/**
 * A11 관리자 팝업(Figma 231:376) — 가운데 경고 아이콘 + 제목 + 설명 + 버튼 1~2개.
 * ⑥ 계정 생성 · ⑦ 단가 저장 확인은 확인/취소, ⑧ 권한 없음은 확인 하나(onConfirm 생략).
 * <dialog> 로 포커스 가두기·ESC 닫기를 브라우저에 맡긴다.
 */
export function AdminConfirm({
  open,
  onClose,
  onConfirm,
  title,
  description,
  confirmLabel = '확인',
  tone = 'brand',
  busy = false,
  confirmDisabled = false,
  children,
}: {
  open: boolean
  onClose: () => void
  onConfirm?: () => void
  title: string
  description: string
  confirmLabel?: string
  tone?: 'brand' | 'danger'
  busy?: boolean
  confirmDisabled?: boolean
  children?: ReactNode
}) {
  const ref = useRef<HTMLDialogElement>(null)
  // 부모가 open=false 로 닫은 경우(단계 전환 등)에도 네이티브 close 이벤트가 뒤늦게 온다.
  // 그때 onClose 를 부르면 부모가 이미 연 다음 단계까지 초기화된다 — 열린 상태에서 닫힌 경우(ESC)만 알린다
  const openRef = useRef(open)
  openRef.current = open
  useEffect(() => {
    const d = ref.current
    if (!d) return
    if (open && !d.open) d.showModal()
    if (!open && d.open) d.close()
  }, [open])

  return (
    <dialog ref={ref} className={s.dialog} aria-label={title} onClose={() => openRef.current && onClose()}>
      <div className={s.dialogBody}>
        <div className={tone === 'danger' ? `${s.alertCircle} ${s.alertDanger}` : s.alertCircle}>
          <img src={tone === 'danger' ? '/ui/alert-danger.svg' : '/ui/admin-alert-brand.svg'} alt="" width={26} height={26} />
        </div>
        <h2 className={s.dialogTitle}>{title}</h2>
        <p className={s.dialogDesc}>{description}</p>
        {children ? <div className={s.dialogExtra}>{children}</div> : null}
        <div className={s.dialogBtns}>
          {onConfirm ? (
            <>
              <button type="button" className={`btn btn-outline ${s.bigBtn}`} onClick={onClose} disabled={busy}>
                취소
              </button>
              <button type="button" className={`btn btn-primary ${s.bigBtn}`} onClick={onConfirm} disabled={busy || confirmDisabled}>
                {busy ? '처리 중…' : confirmLabel}
              </button>
            </>
          ) : (
            <button type="button" className={`btn btn-primary ${s.bigBtn}`} onClick={onClose}>
              {confirmLabel}
            </button>
          )}
        </div>
      </div>
    </dialog>
  )
}

/** ⑧ 권한 없음 — 중간관리자가 편집을 시도했을 때 */
export function NoPermission({ open, onClose }: { open: boolean; onClose: () => void }) {
  return (
    <AdminConfirm
      open={open}
      onClose={onClose}
      tone="danger"
      title="접근 권한이 없습니다"
      description={'이 기능은 최고관리자만 사용하실 수 있습니다.\n필요하시면 최고관리자에게 요청해 주세요.'}
    />
  )
}
