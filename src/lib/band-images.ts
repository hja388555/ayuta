import { EXTENSION_FOR, sniffFileType, type SniffedType } from './file-sniff'

/**
 * 광고 서비스 페이지 상단 띠 이미지(Figma [v2] A6 이미지 관리 229:650).
 * 슬롯은 카테고리 번호와 1:1 — 주문 화면이 `category-${no}` 로 찾는다.
 */
export const BAND_SLOTS = ['category-1', 'category-2', 'category-3', 'category-4', 'category-5'] as const
export type BandSlot = (typeof BAND_SLOTS)[number]

export const BAND_MAX_BYTES = 5 * 1024 * 1024
export const BAND_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp'] as const
type BandMime = (typeof BAND_MIME_TYPES)[number]

export const BAND_TITLES: Record<BandSlot, string> = {
  'category-1': '1. 디지털 광고 / SNS 커뮤니티',
  'category-2': '2. 현지 전문 영상 촬영',
  'category-3': '3. 대표신문 / 지역신문 / 블로그',
  'category-4': '4. 지하철 · 버스광고',
  'category-5': '5. 기타 광고',
}

/**
 * 띠에 보일 위아래 위치(Figma [v2] A6-B 294:2). 0 = 사진 맨 위, 50 = 가운데, 100 = 맨 아래.
 * 화면은 `object-fit: cover` + `object-position: 50% <focusY>%` 로 그린다.
 */
export const BAND_FOCUS_DEFAULT = 50

/** 띠 비율(가로 ÷ 세로) — globals.css 의 .image-band 와 같아야 한다. PC 는 1024px 이상 */
export const BAND_ASPECT = { pc: 12, mobile: 6 } as const

/** 화면에서 움직인 값(슬라이더·드래그)을 0~100 정수로 맞춘다. 숫자가 아니면 가운데로 */
export function clampFocus(v: number): number {
  if (!Number.isFinite(v)) return BAND_FOCUS_DEFAULT
  return Math.min(100, Math.max(0, Math.round(v)))
}

/** API 입력 검사 — 0~100 정수만 받는다(문자열·소수·범위 밖은 null) */
export function parseFocus(v: unknown): number | null {
  return typeof v === 'number' && Number.isInteger(v) && v >= 0 && v <= 100 ? v : null
}

export function bandObjectPosition(focusY: number | null | undefined): string {
  return `50% ${clampFocus(focusY ?? BAND_FOCUS_DEFAULT)}%`
}

/**
 * 사진 위 띠 창의 높이와 위치(px). cover 로 자르면 남는 높이(사진 − 창)의 focusY% 만큼 위가 잘린다.
 * 사진이 띠보다 납작하면 창이 사진 전체다.
 */
export function bandWindow(imageW: number, imageH: number, aspect: number, focusY: number): { top: number; height: number } {
  const height = Math.min(imageH, imageW / aspect)
  return { top: ((imageH - height) * clampFocus(focusY)) / 100, height }
}

/** 창을 dy(px) 만큼 끌었을 때의 새 위치. 움직일 여유가 없으면 그대로 둔다 */
export function focusAfterDrag(startFocus: number, dy: number, imageH: number, windowH: number): number {
  const room = imageH - windowH
  if (room <= 0) return clampFocus(startFocus)
  return clampFocus(startFocus + (dy / room) * 100)
}

export function isBandSlot(v: unknown): v is BandSlot {
  return typeof v === 'string' && (BAND_SLOTS as readonly string[]).includes(v)
}

/**
 * 올린 파일을 내용(매직바이트)으로 확인한다. 브라우저가 보낸 MIME·확장자는 믿지 않는다.
 * 413: 5MB 초과, 400: 빈 파일이거나 JPG·PNG·WEBP 가 아님.
 */
export function checkBandUpload(buf: Uint8Array): { ok: true; mime: BandMime; ext: string } | { ok: false; status: 400 | 413 } {
  if (buf.length === 0) return { ok: false, status: 400 }
  if (buf.length > BAND_MAX_BYTES) return { ok: false, status: 413 }
  const type: SniffedType | null = sniffFileType(buf)
  if (!type || !(BAND_MIME_TYPES as readonly string[]).includes(type)) return { ok: false, status: 400 }
  return { ok: true, mime: type as BandMime, ext: EXTENSION_FOR[type] }
}
