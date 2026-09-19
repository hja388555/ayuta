'use client'

import { useEffect, useRef, useState } from 'react'
import { useTranslations } from 'next-intl'
import { splitContractBlocks, type ContractItemsBlock } from '../lib/contract-text'
import { parseBoldSegments } from '../lib/contract-bold'
import s from './ContractModal.module.css'

/** 조항 본문의 `**강조**`만 굵게 그린다 — 저장된 글자는 그대로, 화면 모양만 바꾼다(contract-bold.ts) */
function ArticleBody({ text }: { text: string }) {
  return (
    <p className={s.articleBody}>
      {parseBoldSegments(text).map((seg, i) => (seg.bold ? <strong key={i}>{seg.text}</strong> : <span key={i}>{seg.text}</span>))}
    </p>
  )
}

type Content = {
  closeLabel: string
  title: string
  /** 스냅샷 위에 따로 붙이는 줄(계약기간·광고시작일 등). 스냅샷을 고치지 않고 합성해 보여준다 */
  facts?: Array<{ label: string; value: string }>
  notice?: string
  contractText: string
  /** 결제 시점 대표자 서명·날인. 서버가 권한 확인 후 data URI 로 넘긴다(src/lib/seal.ts) */
  seal?: { src: string; alt: string }
}

/**
 * 계약서 본문 끝 동의 줄을 실제 체크칸으로 그린다. 나타나는 순서가 결제 화면의 동의 항목 순서와
 * 같다 — 짝이 안 맞으면(줄 수 ≠ 항목 수) 누르게 하지 않고 원문 그대로 보여준다.
 */
type ConsentControl = { keys: string[]; checked: Record<string, boolean>; onToggle: (key: string, next: boolean) => void }

function ConsentLines({ lines, control }: { lines: string[]; control?: ConsentControl }) {
  if (!control || control.keys.length !== lines.length) {
    return (
      <ul className={s.consentList}>
        {lines.map((line, i) => (
          <li key={i} className={s.consentPlain}>
            ☐ {line}
          </li>
        ))}
      </ul>
    )
  }
  return (
    <ul className={s.consentList}>
      {lines.map((line, i) => {
        const key = control.keys[i]!
        return (
          <li key={key}>
            <label className={s.consent}>
              <input type="checkbox" checked={control.checked[key] === true} onChange={(e) => control.onToggle(key, e.target.checked)} />
              <span className={s.consentBox} aria-hidden />
              <span>{line}</span>
            </label>
          </li>
        )
      })}
    </ul>
  )
}

/**
 * 「선택 상품 내용」 구간 — 원문의 ──── 문자 선 대신 진짜 테두리로, 공백 정렬 대신 두 칸으로
 * 그린다. 좁은 폭에서 선이 갈라지지 않는다. 값이 빈 칸(촬영 예정일 등)은 라벨만 보인다.
 */
function ContractItems({ items }: { items: ContractItemsBlock }) {
  return (
    <section className={s.items}>
      <h3 className={s.itemsCaption}>{items.caption}</h3>
      <dl className={s.itemsRows}>
        {items.rows.map((r, i) => (
          <div key={`${r.label}-${i}`} className={s.itemsRow}>
            <dt>{r.label}</dt>
            <dd>{r.value || '—'}</dd>
          </div>
        ))}
      </dl>
      {items.total ? (
        <div className={s.itemsTotal}>
          <span>{items.total.label}</span>
          <strong>{items.total.value || '—'}</strong>
        </div>
      ) : null}
    </section>
  )
}

/**
 * 13-B 계약서 팝업 본체(Figma [v2] 226:43 PC · 226:204 Mobile). open 으로 여닫는다.
 * onConfirm 을 주면 결제 화면용 하단 고정 영역("모두 확인했습니다" + [계약 확인 완료])이 붙는다.
 * 계약서 글은 원문 그대로 — "제N조" 줄을 제목 모양으로 바꿔 보일 뿐 글자는 건드리지 않는다.
 */
export function ContractDialog({
  open,
  onClose,
  onConfirm,
  closeLabel,
  title,
  facts = [],
  notice,
  contractText,
  seal,
  consentControl,
  signature,
  onSignatureChange,
  expectedName,
  signaturePrompt,
  signatureMismatch,
}: Content & {
  open: boolean
  onClose: () => void
  onConfirm?: () => void
  consentControl?: ConsentControl
  /** 결제 화면에서만 쓴다(주문 완료·보관함의 보기 전용 팝업은 서명칸이 없다) */
  signature?: string
  onSignatureChange?: (value: string) => void
  expectedName?: string
  signaturePrompt?: string
  signatureMismatch?: string
}) {
  const t = useTranslations('modal')
  const ref = useRef<HTMLDialogElement>(null)
  const [read, setRead] = useState(false)
  useEffect(() => {
    const d = ref.current
    if (!d) return
    if (open && !d.open) {
      setRead(false)
      d.showModal()
    }
    if (!open && d.open) d.close()
  }, [open])
  const blocks = splitContractBlocks(contractText)
  // 본문 안에서 직접 체크하는 경우엔 하단에 "모두 확인했습니다" 줄을 또 두지 않는다
  const inlineCount = blocks.reduce((n, b) => ('consents' in b ? n + b.consents.length : n), 0)
  const inline = consentControl && consentControl.keys.length === inlineCount ? consentControl : null
  const consentsAgreed = inline ? inline.keys.every((k) => inline.checked[k] === true) : read
  // 서명칸이 있는 팝업(결제)에서는 동의뿐 아니라 이름이 주문자명과 같아야 확인 버튼이 열린다
  const hasSignatureField = onSignatureChange !== undefined
  const typed = signature ?? ''
  const signatureOk = !hasSignatureField || (typed.trim() !== '' && typed.trim() === (expectedName ?? '').trim())
  const showMismatch = hasSignatureField && typed.trim() !== '' && !signatureOk
  const agreed = consentsAgreed && signatureOk

  return (
    <dialog
      ref={ref}
      className={`modal ${s.dialog}`}
      aria-label={title}
      onClose={onClose}
      onClick={(e) => {
        if (e.target === ref.current) onClose()
      }}
    >
      <div className={s.head}>
        <div className={s.titles}>
          <h2 className={s.title}>{title}</h2>
          <p className={s.sub}>{t('contractScrollHint')}</p>
        </div>
        <button type="button" className={s.close} onClick={onClose} aria-label={closeLabel}>
          <img src="/ui/modal-close.svg" alt="" width={20} height={20} />
        </button>
      </div>
      <div className={s.body}>
        {facts.length > 0 ? (
          <dl className={s.facts}>
            {facts.map((f) => (
              <div key={f.label} className={s.fact}>
                <dt>{f.label}</dt>
                <dd>{f.value}</dd>
              </div>
            ))}
          </dl>
        ) : null}
        {notice ? <p className={s.notice}>{notice}</p> : null}
        <div className={s.text}>
          {blocks.map((b, i) =>
            'items' in b ? (
              <ContractItems key={i} items={b.items} />
            ) : 'consents' in b ? (
              <ConsentLines key={i} lines={b.consents} control={consentControl} />
            ) : (
              <section key={i} className={s.article}>
                {b.heading !== null ? <h3 className={s.articleTitle}>{b.heading}</h3> : null}
                {b.body.trim() ? <ArticleBody text={b.body.replace(/^\n+|\n+$/g, '')} /> : null}
              </section>
            ),
          )}
        </div>
        {seal ? (
          <div className={s.seal}>
            <img data-contract-seal="" src={seal.src} alt={seal.alt} />
          </div>
        ) : null}
      </div>
      {onConfirm ? (
        <div className={s.foot}>
          {inline ? null : (
            <label className={s.check}>
              <input type="checkbox" checked={read} onChange={(e) => setRead(e.target.checked)} />
              <span className={s.checkBox} aria-hidden />
              <span>{t('contractConfirmCheck')}</span>
            </label>
          )}
          {hasSignatureField ? (
            <div className={s.signField}>
              <label htmlFor="contract-signature" className={s.signLabel}>
                {t('contractSignatureLabel')}
              </label>
              <input
                id="contract-signature"
                className={s.signInput}
                value={typed}
                required
                aria-required
                aria-invalid={showMismatch || undefined}
                placeholder={signaturePrompt}
                onChange={(e) => onSignatureChange?.(e.target.value)}
              />
              {showMismatch ? <p className={s.signMismatch}>{signatureMismatch}</p> : null}
            </div>
          ) : null}
          <button type="button" className={`btn btn-primary btn-block ${s.confirmBtn}`} disabled={!agreed} onClick={onConfirm}>
            {t('contractConfirm')}
          </button>
        </div>
      ) : null}
    </dialog>
  )
}

type Props = Content & {
  buttonLabel: string
  /** 여는 버튼 모양(.btn 계열 클래스)과 앞 아이콘. 없으면 기존처럼 기본 버튼 */
  buttonClassName?: string
  buttonIcon?: string
}

/** 보기 전용 — 버튼을 누르면 계약서 팝업이 열린다(주문 완료·계약서 보관함·주문 상세) */
export function ContractModal({ buttonLabel, buttonClassName, buttonIcon, ...content }: Props) {
  const [open, setOpen] = useState(false)
  return (
    <>
      <button type="button" className={buttonClassName} onClick={() => setOpen(true)}>
        {buttonIcon ? <img src={buttonIcon} alt="" width={20} height={20} className="btn-icon" /> : null}
        {buttonLabel}
      </button>
      <ContractDialog {...content} open={open} onClose={() => setOpen(false)} />
    </>
  )
}
