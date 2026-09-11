'use client'

import { useEffect, useRef, type ReactNode } from 'react'

/**
 * v2 공통 부품(큐 Q32). 모양은 globals.css 의 클래스가 정하고, 여기서는 구조만 고정한다.
 * 기준: Figma [v2] 00 표지 205:33(번호 단계·카드 선택지) · 205:74(이동 행) · 상태 모음 233:140.
 */

/** ①②③ 번호 단계 제목 */
export function StepTitle({ n, title, hint, id }: { n: number; title: string; hint?: string; id?: string }) {
  return (
    <div className="step-title">
      <span className="step-num" aria-hidden>
        {n}
      </span>
      <div>
        <h2 id={id}>{title}</h2>
        {hint ? <p>{hint}</p> : null}
      </div>
    </div>
  )
}

/**
 * 카드형 선택지. 진짜 input 을 숨겨 두고 카드 전체가 label 이라 키보드·스크린리더 동작은 기본 그대로다.
 * 단일 선택이면서 다시 누르면 해제되어야 하는 경우(표지 목적)는 onClick 으로 토글한다.
 */
export function ChoiceCard({
  type,
  name,
  checked,
  onChange,
  onClick,
  children,
}: {
  type: 'checkbox' | 'radio'
  name?: string
  checked: boolean
  onChange?: () => void
  onClick?: () => void
  children: ReactNode
}) {
  return (
    <label className="choice">
      <input type={type} name={name} checked={checked} onChange={onChange ?? (() => {})} onClick={onClick} />
      <span className="choice-box" aria-hidden />
      <span>{children}</span>
    </label>
  )
}

export function ChoiceGrid({ cols = 2, children, labelledBy }: { cols?: number; children: ReactNode; labelledBy?: string }) {
  return (
    <div className="choice-grid" role="group" aria-labelledby={labelledBy} style={{ ['--cols' as string]: cols }}>
      {children}
    </div>
  )
}

/** 검정 총액 바 */
export function TotalBar({ label, sub, amount }: { label: string; sub?: string; amount: string }) {
  return (
    <div className="total-bar">
      <div>
        <div className="total-bar-label">{label}</div>
        {sub ? <div style={{ fontSize: 14, marginTop: 2 }}>{sub}</div> : null}
      </div>
      <div className="total-bar-amount">{amount}</div>
    </div>
  )
}

export type BadgeTone = 'neutral' | 'brand' | 'success' | 'warning' | 'danger'
export function Badge({ tone = 'neutral', children }: { tone?: BadgeTone; children: ReactNode }) {
  return <span className={tone === 'neutral' ? 'badge' : `badge badge-${tone}`}>{children}</span>
}

/**
 * 모달. <dialog> 로 포커스 가두기·ESC 닫기를 브라우저에 맡긴다(ContractModal 과 같은 방식).
 * open 이 true 가 되면 showModal, false 가 되면 close. 바깥(backdrop)을 누르면 닫는다.
 */
export function Modal({
  open,
  onClose,
  title,
  closeLabel,
  footer,
  children,
}: {
  open: boolean
  onClose: () => void
  title: string
  closeLabel: string
  footer?: ReactNode
  children: ReactNode
}) {
  const ref = useRef<HTMLDialogElement>(null)
  useEffect(() => {
    const d = ref.current
    if (!d) return
    if (open && !d.open) d.showModal()
    if (!open && d.open) d.close()
  }, [open])
  return (
    <dialog
      ref={ref}
      className="modal"
      aria-label={title}
      onClose={onClose}
      onClick={(e) => {
        if (e.target === ref.current) onClose()
      }}
    >
      <div className="modal-head">
        <h2>{title}</h2>
        <button type="button" className="modal-close" onClick={onClose} aria-label={closeLabel}>
          ×
        </button>
      </div>
      <div className="modal-body">{children}</div>
      {footer ? <div className="modal-foot">{footer}</div> : null}
    </dialog>
  )
}

/** 토스트 — 몇 초 뒤 스스로 닫힌다. 성공(초록)·오류(빨강)·안내(검정) */
export function Toast({
  kind = 'info',
  message,
  onClose,
  closeLabel,
  durationMs = 4000,
}: {
  kind?: 'info' | 'success' | 'error'
  message: string
  onClose: () => void
  closeLabel: string
  durationMs?: number
}) {
  useEffect(() => {
    const t = setTimeout(onClose, durationMs)
    return () => clearTimeout(t)
  }, [onClose, durationMs])
  return (
    <div className={kind === 'info' ? 'toast' : `toast toast-${kind}`} role={kind === 'error' ? 'alert' : 'status'}>
      <span>{message}</span>
      <button type="button" onClick={onClose}>
        {closeLabel}
      </button>
    </div>
  )
}
