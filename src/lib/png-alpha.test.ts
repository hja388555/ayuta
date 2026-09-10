import { describe, expect, it } from 'vitest'
import { isPng, isTransparentCapablePng } from './png-alpha'

// 최소 PNG 머리: 시그니처 + IHDR(13바이트 데이터) + 필요하면 추가 청크 + IDAT
const png = (colorType: number, extraChunks: string[] = []) => {
  const bytes: number[] = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]
  const chunk = (type: string, data: number[]) => {
    const len = data.length
    bytes.push((len >>> 24) & 255, (len >>> 16) & 255, (len >>> 8) & 255, len & 255)
    for (const c of type) bytes.push(c.charCodeAt(0))
    bytes.push(...data, 0, 0, 0, 0) // CRC 는 판별에 쓰지 않는다
  }
  chunk('IHDR', [0, 0, 0, 1, 0, 0, 0, 1, 8, colorType, 0, 0, 0])
  for (const t of extraChunks) chunk(t, [0])
  chunk('IDAT', [0])
  chunk('IEND', [])
  return new Uint8Array(bytes)
}

describe('isTransparentCapablePng — 서명·날인 이미지', () => {
  it('RGBA(6)·회색+알파(4)는 받는다', () => {
    expect(isTransparentCapablePng(png(6))).toBe(true)
    expect(isTransparentCapablePng(png(4))).toBe(true)
  })

  it('팔레트(3)는 tRNS 가 있을 때만 받는다', () => {
    expect(isTransparentCapablePng(png(3, ['tRNS']))).toBe(true)
    expect(isTransparentCapablePng(png(3))).toBe(false)
  })

  it('알파 없는 RGB(2)·회색(0)은 거부한다 — 흰 배경이 계약서 글자를 가린다', () => {
    expect(isTransparentCapablePng(png(2))).toBe(false)
    expect(isTransparentCapablePng(png(0))).toBe(false)
  })

  it('PNG 가 아니면(JPEG·SVG·짧은 파일) 거부한다', () => {
    expect(isPng(new Uint8Array([0xff, 0xd8, 0xff, 0xe0]))).toBe(false)
    expect(isTransparentCapablePng(new TextEncoder().encode('<svg xmlns="http://www.w3.org/2000/svg"/>'))).toBe(false)
    expect(isTransparentCapablePng(new Uint8Array(10))).toBe(false)
  })
})
