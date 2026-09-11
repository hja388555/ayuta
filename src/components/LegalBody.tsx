import { Fragment } from 'react'
import { headingsOf, parseLegal, type LegalBlock } from '../lib/legal/parse'
import s from './LegalBody.module.css'

/**
 * 약관 본문 렌더러(Figma [v2] 13-A 모달 · 13-C 환불 · 13-D 개인정보). 원문 평문을 parseLegal 로 나눠
 * 번호 제목·안내 상자·표·주의 문단으로 보여준다. 글자는 고치지 않는다 — 줄바꿈도 원문대로(pre-line).
 * page: 공개 화면(파란 번호 배지, toc 면 목차 칩). modal: 동의 모달(굵은 제목만).
 */
export function LegalBody({ body, variant = 'page', toc = false, tocLabel }: { body: string; variant?: 'page' | 'modal'; toc?: boolean; tocLabel?: string }) {
  const blocks = parseLegal(body)
  const headings = headingsOf(blocks)
  const visible = blocks.filter((b) => b.type !== 'blank')
  const lastPara = [...visible].reverse().find((b) => b.type === 'paragraph')
  // 맨 끝의 "…동의합니다." 문단은 확인 문구 상자로(13-A)
  const closing = headings.length > 0 && lastPara === visible[visible.length - 1] && lastPara?.type === 'paragraph' && /동의합니다\.?$/.test(lastPara.text.trim()) ? lastPara : null

  const out: React.ReactNode[] = []
  for (let i = 0; i < visible.length; i++) {
    const b = visible[i]!
    if (b.type === 'callout') {
      const next = visible[i + 1]
      const text = next && (next.type === 'paragraph' || next.type === 'note') ? next : null
      if (text) i++
      out.push(
        <div key={i} className={s.callout}>
          <p className={s.calloutTitle}>{b.title}</p>
          {text ? <p className={s.pre}>{text.raw}</p> : null}
        </div>,
      )
    } else out.push(<Fragment key={i}>{render(b, variant, b === closing)}</Fragment>)
  }

  return (
    <div className={variant === 'modal' ? `${s.body} ${s.modal}` : s.body} data-legal-body="">
      {toc && headings.length > 0 ? (
        <nav className={s.toc} aria-label={tocLabel}>
          {tocLabel ? <p className={s.tocTitle}>{tocLabel}</p> : null}
          <div className={s.chips}>
            {headings.map((h) => (
              <a key={h.id} href={`#${h.id}`} className={s.chip}>
                {h.num} {h.text.replace(/^(제\s*\d+\s*조|\d+\.)\s*/, '')}
              </a>
            ))}
          </div>
        </nav>
      ) : null}
      {out}
    </div>
  )
}

function render(b: LegalBlock, variant: 'page' | 'modal', closing: boolean) {
  switch (b.type) {
    case 'heading':
      return variant === 'modal' ? (
        <h3 id={b.id} className={s.headingModal}>
          {b.text}
        </h3>
      ) : (
        <h2 id={b.id} className={s.heading}>
          <span className={s.badge} aria-hidden>
            {b.num}
          </span>
          {b.text}
        </h2>
      )
    case 'table': {
      const [head, ...rows] = b.rows
      return (
        <div className={s.tableWrap}>
          <table className={s.table}>
            {head ? (
              <thead>
                <tr>
                  {head.map((c, j) => (
                    <th key={j}>{c}</th>
                  ))}
                </tr>
              </thead>
            ) : null}
            <tbody>
              {rows.map((r, k) => (
                <tr key={k}>
                  {r.map((c, j) => (
                    <td key={j}>{c}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )
    }
    case 'note':
      return <p className={`${s.pre} ${s.note}`}>{b.text}</p>
    case 'paragraph':
      return <p className={closing ? `${s.pre} ${s.closing}` : `${s.pre} ${s.para}`}>{b.text}</p>
    default:
      return null
  }
}
