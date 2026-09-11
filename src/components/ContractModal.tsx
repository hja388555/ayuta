'use client'

import { useEffect, useRef, useState } from 'react'
import { useTranslations } from 'next-intl'
import { splitContractBlocks } from '../lib/contract-text'
import s from './ContractModal.module.css'

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
}: Content & { open: boolean; onClose: () => void; onConfirm?: () => void }) {
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
          {blocks.map((b, i) => (
            <section key={i} className={s.article}>
              {b.heading !== null ? <h3 className={s.articleTitle}>{b.heading}</h3> : null}
              {b.body.trim() ? <p className={s.articleBody}>{b.body.replace(/^\n+|\n+$/g, '')}</p> : null}
            </section>
          ))}
        </div>
        {seal ? (
          <div className={s.seal}>
            <img data-contract-seal="" src={seal.src} alt={seal.alt} />
          </div>
        ) : null}
      </div>
      {onConfirm ? (
        <div className={s.foot}>
          <label className={s.check}>
            <input type="checkbox" checked={read} onChange={(e) => setRead(e.target.checked)} />
            <span className={s.checkBox} aria-hidden />
            <span>{t('contractConfirmCheck')}</span>
          </label>
          <button type="button" className={`btn btn-primary btn-block ${s.confirmBtn}`} disabled={!read} onClick={onConfirm}>
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
