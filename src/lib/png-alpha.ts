/**
 * 업로드한 PNG 가 투명 배경을 담을 수 있는지(알파 채널이 있는지) 판별한다.
 * 대표자 서명·날인 이미지는 계약서 위에 겹쳐 올리므로 흰 배경이 있으면 글자를 가린다(큐 Q25:
 * "투명 PNG"). 실제로 모든 픽셀이 불투명한지까지 보려면 이미지를 풀어야 하므로, 여기서는
 * 파일 형식이 투명도를 표현할 수 있는지만 본다 — 흰 배경을 칠한 RGBA PNG 는 걸러지지 않는다.
 *
 * PNG 구조: 8바이트 시그니처 → IHDR 청크(길이 4 + "IHDR" 4 + 데이터 13 + CRC 4).
 * IHDR 데이터의 10번째 바이트(파일 기준 25)가 color type 이다.
 *  - 4: 회색 + 알파, 6: RGB + 알파 → 투명 가능
 *  - 3: 팔레트 → tRNS 청크가 있으면 투명 가능
 *  - 0·2(알파 없음)도 tRNS 로 한 색을 투명 처리할 수 있지만, 날인 이미지로는 받지 않는다
 */
const SIG = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]

export function isPng(buf: Uint8Array): boolean {
  return buf.length >= 33 && SIG.every((b, i) => buf[i] === b) && String.fromCharCode(...buf.slice(12, 16)) === 'IHDR'
}

function hasChunk(buf: Uint8Array, type: string): boolean {
  let pos = 8
  while (pos + 8 <= buf.length) {
    const len = ((buf[pos]! << 24) | (buf[pos + 1]! << 16) | (buf[pos + 2]! << 8) | buf[pos + 3]!) >>> 0
    const t = String.fromCharCode(...buf.slice(pos + 4, pos + 8))
    if (t === type) return true
    if (t === 'IDAT' || t === 'IEND') return false // tRNS 는 IDAT 앞에만 온다
    pos += 12 + len
  }
  return false
}

export function isTransparentCapablePng(buf: Uint8Array): boolean {
  if (!isPng(buf)) return false
  const colorType = buf[25]
  if (colorType === 4 || colorType === 6) return true
  if (colorType === 3) return hasChunk(buf, 'tRNS')
  return false
}
