/**
 * 업로드 파일의 실제 형식을 앞머리 바이트(매직바이트)로 판별한다.
 *
 * 확장자와 브라우저가 보낸 MIME 은 고객이 마음대로 바꿀 수 있다. "사진.jpg" 라는 이름의
 * SVG(스크립트를 품을 수 있다)나 HTML 을 그대로 받아 관리자가 열면 관리자 세션에서
 * 스크립트가 돈다. 그래서 허용 목록의 형식만, 내용으로 확인해서 받는다.
 */
export type SniffedType = 'image/jpeg' | 'image/png' | 'image/webp' | 'application/pdf'

const startsWith = (buf: Uint8Array, bytes: number[], offset = 0) =>
  buf.length >= offset + bytes.length && bytes.every((b, i) => buf[offset + i] === b)

export function sniffFileType(buf: Uint8Array): SniffedType | null {
  if (startsWith(buf, [0xff, 0xd8, 0xff])) return 'image/jpeg'
  if (startsWith(buf, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) return 'image/png'
  // RIFF....WEBP
  if (startsWith(buf, [0x52, 0x49, 0x46, 0x46]) && startsWith(buf, [0x57, 0x45, 0x42, 0x50], 8)) return 'image/webp'
  if (startsWith(buf, [0x25, 0x50, 0x44, 0x46, 0x2d])) return 'application/pdf' // %PDF-
  return null
}

export const EXTENSION_FOR: Record<SniffedType, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'application/pdf': 'pdf',
}
