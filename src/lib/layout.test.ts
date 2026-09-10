import { describe, expect, it } from 'vitest'
import { contentWidth, sidePadding } from './layout'

describe('좌우 여백', () => {
  it('모바일은 16을 쓴다', () => {
    expect(sidePadding(390)).toBe(16)
    expect(sidePadding(767)).toBe(16)
  })

  it('태블릿은 32를 쓴다', () => {
    expect(sidePadding(768)).toBe(32)
    expect(sidePadding(1023)).toBe(32)
  })

  it('1024부터 1536까지는 48이 최소값이다', () => {
    expect(sidePadding(1024)).toBe(48)
    expect(sidePadding(1200)).toBe(48)
    expect(sidePadding(1440)).toBe(48)
    expect(sidePadding(1536)).toBe(48)
  })

  it('1440 + 96을 넘어서야 남는 폭을 반씩 나눈다', () => {
    expect(sidePadding(1920)).toBe(240)
    expect(sidePadding(2560)).toBe(560)
  })

  it('1440까지는 콘텐츠가 화면을 꽉 채운다', () => {
    // 1440에서 좌우가 비어 보이면 안 된다
    expect(contentWidth(1440)).toBe(1344)
    expect(contentWidth(1200)).toBe(1104)
    expect(contentWidth(1024)).toBe(928)
    expect(contentWidth(390)).toBe(358)
  })

  it('콘텐츠 폭은 1440을 넘지 않는다', () => {
    expect(contentWidth(1920)).toBe(1440)
    expect(contentWidth(2560)).toBe(1440)
    expect(contentWidth(3840)).toBe(1440)
  })

  it('여백은 음수가 되지 않는다', () => {
    for (const w of [0, 1, 320, 375]) expect(sidePadding(w)).toBeGreaterThanOrEqual(0)
  })
})
