import { describe, expect, it } from 'vitest'
import { BAND_MAX_BYTES, checkBandUpload, isBandSlot } from './band-images'

const png = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00])

describe('isBandSlot', () => {
  it('category-1~5 만 받는다', () => {
    expect(isBandSlot('category-1')).toBe(true)
    expect(isBandSlot('category-5')).toBe(true)
    expect(isBandSlot('category-6')).toBe(false)
    expect(isBandSlot('../category-1')).toBe(false)
    expect(isBandSlot(1)).toBe(false)
  })
})

describe('checkBandUpload', () => {
  it('JPG·PNG·WEBP 를 내용으로 알아본다', () => {
    expect(checkBandUpload(png)).toEqual({ ok: true, mime: 'image/png', ext: 'png' })
    expect(checkBandUpload(new Uint8Array([0xff, 0xd8, 0xff, 0xe0]))).toMatchObject({ ok: true, mime: 'image/jpeg' })
    expect(checkBandUpload(new TextEncoder().encode('RIFF    WEBPVP8 '))).toMatchObject({ ok: true, mime: 'image/webp' })
  })

  it('PDF·SVG·빈 파일은 400', () => {
    expect(checkBandUpload(new TextEncoder().encode('%PDF-1.7'))).toEqual({ ok: false, status: 400 })
    expect(checkBandUpload(new TextEncoder().encode('<svg></svg>'))).toEqual({ ok: false, status: 400 })
    expect(checkBandUpload(new Uint8Array())).toEqual({ ok: false, status: 400 })
  })

  it('5MB 를 넘으면 413', () => {
    const big = new Uint8Array(BAND_MAX_BYTES + 1)
    big.set(png)
    expect(checkBandUpload(big)).toEqual({ ok: false, status: 413 })
  })
})
