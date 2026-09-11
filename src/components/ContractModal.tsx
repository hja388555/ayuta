'use client'

import { useRef } from 'react'

type Props = {
  buttonLabel: string
  closeLabel: string
  title: string
  /** 스냅샷 위에 따로 붙이는 줄(계약기간·광고시작일 등). 스냅샷을 고치지 않고 합성해 보여준다 */
  facts?: Array<{ label: string; value: string }>
  notice?: string
  contractText: string
  /** 결제 시점 대표자 서명·날인. 서버가 권한 확인 후 data URI 로 넘긴다(src/lib/seal.ts) */
  seal?: { src: string; alt: string }
  /** 여는 버튼 모양(.btn 계열 클래스)과 앞 아이콘. 없으면 기존처럼 기본 버튼 */
  buttonClassName?: string
  buttonIcon?: string
}

/**
 * 계약서 전문 팝업(요구사항 계약서 보관함 — "13-B 팝업과 같은 모달로 스냅샷 전문을 띄운다").
 * 내용은 결제 시점에 저장한 스냅샷 그대로다. <dialog> 를 써서 포커스 가두기·ESC 닫기를
 * 브라우저에 맡긴다. 본문은 서버가 그린 HTML 에 들어 있고 열 때 보이기만 한다.
 */
export function ContractModal({ buttonLabel, closeLabel, title, facts = [], notice, contractText, seal, buttonClassName, buttonIcon }: Props) {
  const ref = useRef<HTMLDialogElement>(null)
  return (
    <>
      <button type="button" className={buttonClassName} onClick={() => ref.current?.showModal()}>
        {buttonIcon ? <img src={buttonIcon} alt="" width={20} height={20} className="btn-icon" /> : null}
        {buttonLabel}
      </button>
      <dialog
        ref={ref}
        aria-label={title}
        style={{ width: 'min(720px, 92vw)', maxHeight: '85vh', padding: 0, border: 'none', borderRadius: 12 }}
        onClick={(e) => {
          // 바깥(backdrop)을 누르면 닫는다
          if (e.target === ref.current) ref.current?.close()
        }}
      >
        <div style={{ padding: '20px 24px', overflowY: 'auto', maxHeight: '85vh' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 16 }}>
            <h2 style={{ margin: 0, fontSize: 'var(--fs-h3, 18px)' }}>{title}</h2>
            <button type="button" onClick={() => ref.current?.close()}>
              {closeLabel}
            </button>
          </div>
          {facts.length > 0 ? (
            <dl style={{ display: 'grid', gridTemplateColumns: 'auto 1fr', gap: '6px 16px', margin: '16px 0' }}>
              {facts.map((f) => (
                <div key={f.label} style={{ display: 'contents' }}>
                  <dt style={{ color: 'var(--ink-500)' }}>{f.label}</dt>
                  <dd style={{ margin: 0 }}>{f.value}</dd>
                </div>
              ))}
            </dl>
          ) : null}
          {notice ? <p style={{ fontWeight: 600, color: 'var(--ink-500)' }}>{notice}</p> : null}
          <pre style={{ whiteSpace: 'pre-wrap', fontFamily: 'inherit', margin: 0 }}>{contractText}</pre>
          {seal ? (
            <div style={{ textAlign: 'right', marginTop: 16 }}>
              <img data-contract-seal="" src={seal.src} alt={seal.alt} style={{ maxWidth: 160, maxHeight: 100 }} />
            </div>
          ) : null}
        </div>
      </dialog>
    </>
  )
}
