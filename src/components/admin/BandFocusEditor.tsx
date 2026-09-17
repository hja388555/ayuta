'use client'

import { useRef, useState, type PointerEvent } from 'react'
import { useRouter } from 'next/navigation'
import { adminErrorMessage } from '@/lib/admin/error-messages'
import { BAND_ASPECT, bandObjectPosition, bandWindow, clampFocus, focusAfterDrag } from '@/lib/band-images'
import { NoPermission } from './AdminConfirm'
import s from './admin-v2.module.css'

const QUICK = [
  { label: '위', value: 0 },
  { label: '가운데', value: 50 },
  { label: '아래', value: 100 },
] as const

/** 사진이 아주 길어도 화면을 넘지 않게 — 편집 영역 높이 상한(px) */
const STAGE_MAX_H = 520

/**
 * A6-B 위치 조정 본체. 사진 전체 위에 PC 띠(12:1) 창을 올리고, 사진을 끌거나 슬라이더·빠른 버튼으로 옮긴다.
 * 창과 미리보기는 고객 띠와 같은 규칙(cover + object-position 50% focusY%)으로 그린다.
 */
export function BandFocusEditor({
  slot,
  src,
  width,
  height,
  initialFocus,
  canEdit,
}: {
  slot: string
  src: string
  width: number | null
  height: number | null
  initialFocus: number
  canEdit: boolean
}) {
  const router = useRouter()
  const [focus, setFocus] = useState(clampFocus(initialFocus))
  const [size, setSize] = useState(width && height ? { w: width, h: height } : null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [done, setDone] = useState(false)
  const [denied, setDenied] = useState(false)
  const drag = useRef<{ id: number; y: number; focus: number; h: number } | null>(null)

  // 창 위치·높이를 사진 크기 대비 %로 둔다 — 화면 폭이 바뀌어도 다시 잴 필요가 없다
  const win = size ? bandWindow(size.w, size.h, BAND_ASPECT.pc, focus) : { top: 0, height: 0 }
  const winStyle = size ? { top: `${(win.top / size.h) * 100}%`, height: `${(win.height / size.h) * 100}%` } : { display: 'none' }
  const ratio = size ? size.w / size.h : 4

  function change(v: number) {
    setFocus(clampFocus(v))
    setDone(false)
  }

  function onPointerDown(e: PointerEvent<HTMLDivElement>) {
    if (!size) return
    e.currentTarget.setPointerCapture(e.pointerId)
    drag.current = { id: e.pointerId, y: e.clientY, focus, h: e.currentTarget.getBoundingClientRect().height }
  }

  function onPointerMove(e: PointerEvent<HTMLDivElement>) {
    const d = drag.current
    if (!d || d.id !== e.pointerId || !size) return
    const windowH = (d.h * bandWindow(size.w, size.h, BAND_ASPECT.pc, 0).height) / size.h
    change(focusAfterDrag(d.focus, e.clientY - d.y, d.h, windowH))
  }

  function endDrag(e: PointerEvent<HTMLDivElement>) {
    if (drag.current?.id === e.pointerId) drag.current = null
  }

  async function save() {
    if (!canEdit) return setDenied(true)
    setBusy(true)
    setError(null)
    setDone(false)
    try {
      const res = await fetch(`/api/admin/images/${slot}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ focusY: focus }),
      })
      const json = await res.json().catch(() => ({}))
      if (!res.ok || !json?.ok) return setError(adminErrorMessage(json?.error))
      setDone(true)
      router.refresh()
    } catch {
      setError(adminErrorMessage('network'))
    } finally {
      setBusy(false)
    }
  }

  const position = bandObjectPosition(focus)

  return (
    <section className={s.focusCard} aria-label="띠 위치 조정">
      <p className={s.hint}>사진을 위아래로 끌거나 슬라이더를 움직여, 파란 상자 안이 서비스 페이지 상단 띠에 보이게 맞춰 주세요.</p>

      <div
        className={s.focusStage}
        style={{ aspectRatio: String(ratio), width: `min(100%, ${Math.round(STAGE_MAX_H * ratio)}px)` }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
        data-testid="focus-stage"
      >
        <img src={src} alt="올린 사진 전체" draggable={false} onLoad={(e) => size ?? setSize({ w: e.currentTarget.naturalWidth, h: e.currentTarget.naturalHeight })} />
        <div className={s.focusWindow} style={winStyle} data-testid="focus-window">
          <span className={s.focusHandle}>↕ 끌어서 위치 조정</span>
        </div>
      </div>

      <div className={s.focusRow}>
        <label className={s.focusLabel} htmlFor={`focus-${slot}`}>
          표시 위치
        </label>
        <input
          id={`focus-${slot}`}
          className={s.focusRange}
          type="range"
          min={0}
          max={100}
          step={1}
          value={focus}
          onChange={(e) => change(Number(e.target.value))}
          aria-valuetext={`${focus}%`}
        />
        <span className={s.focusPct} aria-hidden="true" data-testid="focus-pct">
          {focus}%
        </span>
        <div className={s.focusQuick}>
          {QUICK.map((q) => (
            <button key={q.value} type="button" aria-pressed={focus === q.value} onClick={() => change(q.value)}>
              {q.label}
            </button>
          ))}
        </div>
      </div>

      <div className={s.focusPreviews}>
        <figure className={s.focusPreview}>
          <figcaption>PC 띠 미리보기 (1440 × {Math.round(1440 / BAND_ASPECT.pc)})</figcaption>
          <img src={src} alt="" style={{ aspectRatio: String(BAND_ASPECT.pc), objectPosition: position }} data-testid="preview-pc" />
        </figure>
        <figure className={s.focusPreview}>
          <figcaption>모바일 띠 미리보기 (390 × {Math.round(390 / BAND_ASPECT.mobile)})</figcaption>
          <img src={src} alt="" style={{ aspectRatio: String(BAND_ASPECT.mobile), objectPosition: position }} data-testid="preview-mobile" />
        </figure>
      </div>

      <div className={s.focusBtns}>
        <button type="button" className={`btn btn-outline ${s.bigBtn}`} onClick={() => router.push('/manage/images')} disabled={busy}>
          취소
        </button>
        <button type="button" className={`btn btn-primary ${s.bigBtn}`} onClick={save} disabled={busy}>
          {busy ? '저장 중…' : '위치 저장'}
        </button>
      </div>
      {done ? (
        <p className={s.ok} role="status">
          위치를 저장했습니다. 서비스 페이지 상단 띠에 반영되었습니다.
        </p>
      ) : null}
      {error ? (
        <p className={s.err} role="alert">
          {error}
        </p>
      ) : null}
      <p className={s.focusNote}>저장하면 서비스 페이지 상단 띠에 바로 반영됩니다. 이미지를 교체하면 위치는 가운데(50%)로 돌아갑니다.</p>
      <NoPermission open={denied} onClose={() => setDenied(false)} />
    </section>
  )
}
