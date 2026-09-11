import { describe, expect, it } from 'vitest'
import { bubbleText, cleanBody, fallbackTarget, isRateLimited, rateWindowStart, targetLang, toChatLocale } from './rules'

describe('cleanBody', () => {
  it('제어 문자를 지우고 줄바꿈은 남긴다', () => {
    expect(cleanBody('  안녕\u0007하세요\u200E\r\n다음\t줄 ')).toBe('안녕하세요\n다음\t줄')
  })
  it('비었거나 2000자를 넘으면 null', () => {
    expect(cleanBody('   \u0001 ')).toBeNull()
    expect(cleanBody('a'.repeat(2001))).toBeNull()
    expect(cleanBody('a'.repeat(2000))).toHaveLength(2000)
  })
  it('HTML 은 글자 그대로 둔다(렌더링이 이스케이프한다)', () => {
    expect(cleanBody('<b>hi</b>')).toBe('<b>hi</b>')
  })
})

describe('targetLang', () => {
  it('고객 글은 한국어로, 관리자 글은 일본어 방에서만 일본어로', () => {
    expect(targetLang('customer', 'ja')).toBe('KO')
    expect(targetLang('customer', 'ko')).toBe('KO')
    expect(targetLang('admin', 'ja')).toBe('JA')
    expect(targetLang('admin', 'ko')).toBeNull()
  })
  it('모르는 로케일은 ko', () => {
    expect(toChatLocale('ja')).toBe('ja')
    expect(toChatLocale('en')).toBe('ko')
  })
})

describe('rate limit', () => {
  it('1분에 20개까지', () => {
    expect(isRateLimited(19)).toBe(false)
    expect(isRateLimited(20)).toBe(true)
    expect(rateWindowStart(new Date('2026-09-11T00:01:00Z')).toISOString()).toBe('2026-09-11T00:00:00.000Z')
  })
})

describe('bubbleText', () => {
  const adminToJa = { body: '안녕하세요', translatedBody: 'こんにちは', sourceLang: 'KO', translatedLang: 'JA', translationStatus: 'ok' }
  it('보는 사람 언어로 된 쪽을 위에', () => {
    expect(bubbleText(adminToJa, 'ja')).toEqual({ primary: 'こんにちは', secondary: '안녕하세요' })
    expect(bubbleText(adminToJa, 'ko')).toEqual({ primary: '안녕하세요', secondary: 'こんにちは' })
  })
  it('번역이 없거나 실패면 원문만', () => {
    expect(bubbleText({ ...adminToJa, translationStatus: 'failed' }, 'ja')).toEqual({ primary: '안녕하세요', secondary: null })
    expect(bubbleText({ body: 'x', translationStatus: 'skipped' }, 'ko')).toEqual({ primary: 'x', secondary: null })
  })
})

describe('fallbackTarget', () => {
  it('일본어 방에서 관리자가 일본어로 쓰면(감지 JA = 목표 JA) 한국어로 번역한다', () => {
    expect(fallbackTarget('ja', 'JA', 'JA')).toBe('KO')
  })
  it('일본어 방에서 고객이 한국어로 쓰면(감지 KO = 목표 KO) 일본어로 번역한다', () => {
    expect(fallbackTarget('ja', 'KO', 'ko')).toBe('JA')
  })
  it('감지 언어가 목표와 다르거나 모르면 다시 번역하지 않는다', () => {
    expect(fallbackTarget('ja', 'KO', 'JA')).toBeNull()
    expect(fallbackTarget('ja', 'KO', null)).toBeNull()
  })
  it('한국어 방은 다시 번역하지 않는다', () => {
    expect(fallbackTarget('ko', 'KO', 'KO')).toBeNull()
  })
})
