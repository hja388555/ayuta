'use client'

import { useEffect, useRef, useState } from 'react'
import { useLocale, useTranslations } from 'next-intl'
import { Modal } from './ui'
import { normalizeJpZip, type AddressPick, type JpAddress } from '../lib/address'
import s from './AddressSearch.module.css'

/**
 * 주소 검색 버튼 + 팝업(Figma [v2] 팝업 B 233:2).
 * - 한국 주소: 카카오(다음) 우편번호 서비스를 모달 안에 embed. 키가 필요 없고, 스크립트는 처음 열 때만 받는다.
 * - 일본 주소(ja 로케일): 우편번호 7자리 → /api/address/jp(zipcloud 프록시) → 결과 카드.
 * 고르면 onSelect 로 우편번호·기본주소를 넘기고 focusId(상세주소 칸)로 포커스를 옮긴다.
 */
type Props = {
  onSelect: (pick: AddressPick) => void
  locale?: string
  focusId?: string
  className?: string
  disabled?: boolean
  labels?: Partial<Record<'button' | 'title' | 'close', string>>
}

const POSTCODE_SRC = 'https://t1.daumcdn.net/mapjsapi/bundle/postcode/prod/postcode.v2.js'

type DaumData = { zonecode: string; roadAddress: string; jibunAddress: string; autoJibunAddress?: string }
type DaumPostcode = new (o: { oncomplete: (d: DaumData) => void; width: string; height: string }) => { embed: (el: HTMLElement) => void }
declare global {
  interface Window {
    daum?: { Postcode: DaumPostcode }
  }
}

let postcodeLoad: Promise<void> | null = null
function loadPostcode(): Promise<void> {
  if (window.daum?.Postcode) return Promise.resolve()
  postcodeLoad ??= new Promise<void>((resolve, reject) => {
    const el = document.createElement('script')
    el.src = POSTCODE_SRC
    el.async = true
    el.onload = () => resolve()
    el.onerror = () => {
      postcodeLoad = null
      el.remove()
      reject(new Error('postcode script'))
    }
    document.head.appendChild(el)
  })
  return postcodeLoad
}

export function AddressSearch({ onSelect, locale: localeProp, focusId, className, disabled, labels }: Props) {
  const t = useTranslations('address')
  const current = useLocale()
  const locale = localeProp ?? current
  const mode = locale === 'ja' ? 'jp' : 'kr'
  const [open, setOpen] = useState(false)

  function pick(p: AddressPick) {
    onSelect(p)
    setOpen(false)
    if (focusId) setTimeout(() => document.getElementById(focusId)?.focus(), 0)
  }

  return (
    <>
      <button type="button" className={className ?? 'btn btn-secondary'} disabled={disabled} onClick={() => setOpen(true)}>
        <img src="/ui/search.svg" alt="" width={18} height={18} />
        {labels?.button ?? t('button')}
      </button>
      <Modal open={open} onClose={() => setOpen(false)} title={labels?.title ?? t('title')} closeLabel={labels?.close ?? t('close')}>
        {open ? mode === 'kr' ? <KrPanel onPick={pick} /> : <JpPanel onPick={pick} /> : null}
      </Modal>
    </>
  )
}

function KrPanel({ onPick }: { onPick: (p: AddressPick) => void }) {
  const t = useTranslations('address')
  const box = useRef<HTMLDivElement>(null)
  const [state, setState] = useState<'loading' | 'ready' | 'failed'>('loading')

  useEffect(() => {
    let alive = true
    loadPostcode()
      .then(() => {
        if (!alive || !box.current || !window.daum) return
        new window.daum.Postcode({
          width: '100%',
          height: '100%',
          oncomplete: (d) => onPick({ postalCode: d.zonecode, address1: d.roadAddress || d.jibunAddress || d.autoJibunAddress || '' }),
        }).embed(box.current)
        setState('ready')
      })
      .catch(() => alive && setState('failed'))
    return () => {
      alive = false
    }
    // onPick 은 매 렌더 새로 만들어지지만 embed 는 한 번만 한다
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <div className={s.body}>
      <p className={s.hint}>{t('krExample')}</p>
      {state === 'loading' ? <p className={s.status}>{t('loading')}</p> : null}
      {state === 'failed' ? <p className={s.error} role="alert">{t('failed')}</p> : null}
      <div ref={box} className={s.embed} hidden={state === 'failed'} />
    </div>
  )
}

function JpPanel({ onPick }: { onPick: (p: AddressPick) => void }) {
  const t = useTranslations('address')
  const [zip, setZip] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [results, setResults] = useState<JpAddress[] | null>(null)

  async function search(e: React.SyntheticEvent) {
    e.preventDefault()
    e.stopPropagation()
    const z = normalizeJpZip(zip)
    if (!z) return setError(t('invalidZip'))
    setBusy(true)
    setError('')
    try {
      const res = await fetch(`/api/address/jp?zipcode=${z}`)
      const json = (await res.json().catch(() => ({}))) as { results?: JpAddress[] }
      if (!res.ok || !Array.isArray(json.results)) throw new Error()
      setResults(json.results)
    } catch {
      setError(t('failed'))
      setResults(null)
    } finally {
      setBusy(false)
    }
  }

  // 바깥 폼 안에 렌더되므로 <form> 대신 div + Enter 처리로 중첩 폼을 피한다
  return (
    <div className={s.body}>
      <div className={s.search}>
        <img src="/ui/search.svg" alt="" width={18} height={18} />
        <input
          value={zip}
          onChange={(e) => setZip(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.nativeEvent.isComposing) search(e)
          }}
          placeholder={t('jpPlaceholder')}
          aria-label={t('jpPlaceholder')}
          inputMode="numeric"
          autoComplete="postal-code"
          maxLength={10}
          autoFocus
        />
        <button type="button" className={`btn btn-primary ${s.searchGo}`} onClick={search} disabled={busy}>
          {t('submit')}
        </button>
      </div>
      <p className={s.hint}>{t('jpExample')}</p>
      {busy ? <p className={s.status}>{t('loading')}</p> : null}
      {error ? <p className={s.error} role="alert">{error}</p> : null}
      {results && results.length === 0 ? <p className={s.status}>{t('noResult')}</p> : null}
      {results && results.length > 0 ? (
        <ul className={s.list}>
          {results.map((r) => (
            <li key={r.address}>
              <button type="button" className={s.card} onClick={() => onPick({ postalCode: r.postalCode, address1: r.address })}>
                <span className={s.cardRow}>
                  <span className={s.zip}>〒{r.postalCode}</span>
                  <span className={s.addr}>{r.address}</span>
                </span>
                <span className={s.sub}>{[r.prefecture, r.city, r.town].filter(Boolean).join(' · ')}</span>
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  )
}
