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
