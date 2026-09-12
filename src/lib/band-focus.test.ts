import { describe, expect, it } from 'vitest'
import { BAND_FOCUS_DEFAULT, bandObjectPosition, bandWindow, clampFocus, focusAfterDrag, parseFocus } from './band-images'

describe('clampFocus', () => {
  it('0~100 정수로 반올림·자른다', () => {
    expect(clampFocus(45.4)).toBe(45)
    expect(clampFocus(45.5)).toBe(46)
    expect(clampFocus(-3)).toBe(0)
    expect(clampFocus(140)).toBe(100)
  })

  it('숫자가 아니면 가운데', () => {
    expect(clampFocus(Number.NaN)).toBe(BAND_FOCUS_DEFAULT)
    expect(clampFocus(Number.POSITIVE_INFINITY)).toBe(BAND_FOCUS_DEFAULT)
  })
})

describe('parseFocus', () => {
  it('0~100 정수만 받는다', () => {
    expect(parseFocus(0)).toBe(0)
    expect(parseFocus(100)).toBe(100)
    expect(parseFocus(37)).toBe(37)
  })

  it('소수·범위 밖·문자열·빈 값은 null', () => {
    for (const v of [12.5, -1, 101, '50', null, undefined, Number.NaN, true]) expect(parseFocus(v)).toBeNull()
  })
})

describe('bandObjectPosition', () => {
  it('가로는 가운데, 세로는 focusY%', () => {
    expect(bandObjectPosition(20)).toBe('50% 20%')
    expect(bandObjectPosition(null)).toBe('50% 50%')
  })
})

describe('bandWindow', () => {
  it('남는 높이의 focusY% 만큼 내려간다', () => {
    // 1200×600 사진, 12:1 창 = 높이 100, 남는 높이 500
    expect(bandWindow(1200, 600, 12, 0)).toEqual({ top: 0, height: 100 })
    expect(bandWindow(1200, 600, 12, 50)).toEqual({ top: 250, height: 100 })
    expect(bandWindow(1200, 600, 12, 100)).toEqual({ top: 500, height: 100 })
  })

  it('띠보다 납작한 사진은 창이 사진 전체', () => {
    expect(bandWindow(2400, 100, 12, 70)).toEqual({ top: 0, height: 100 })
  })
})

describe('focusAfterDrag', () => {
  it('끈 거리를 남는 높이 대비 %로 바꾼다', () => {
    // 표시 높이 500, 창 100 → 400px 가 0~100%
    expect(focusAfterDrag(50, 40, 500, 100)).toBe(60)
    expect(focusAfterDrag(50, -100, 500, 100)).toBe(25)
  })

  it('끝을 넘으면 0·100 에서 멈춘다', () => {
    expect(focusAfterDrag(90, 1000, 500, 100)).toBe(100)
    expect(focusAfterDrag(10, -1000, 500, 100)).toBe(0)
  })

  it('움직일 여유가 없으면 그대로', () => {
    expect(focusAfterDrag(30, 50, 100, 100)).toBe(30)
  })
})
