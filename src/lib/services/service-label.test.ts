import { describe, expect, it } from 'vitest'
import { serviceLabel } from './service-label'

const db = { nameKo: '옥외 전광판 광고', nameJa: '屋外電光掲示板広告' }

describe('서비스 이름 표시', () => {
  it('DB 이름을 쓰고 앞에 번호를 붙인다', () => {
    expect(serviceLabel(6, 'ko', db, undefined)).toBe('6. 옥외 전광판 광고')
    expect(serviceLabel(6, 'ja', db, undefined)).toBe('6. 屋外電光掲示板広告')
  })

  it('이름이 이미 번호로 시작하면 또 붙이지 않는다', () => {
    // 관리자가 "6. 옥외 광고" 라고 적어 두는 경우가 흔하다
    expect(serviceLabel(6, 'ko', { nameKo: '6. 옥외 광고', nameJa: '6. 屋外広告' }, undefined)).toBe('6. 옥외 광고')
    expect(serviceLabel(1, 'ko', { nameKo: '1·디지털 광고', nameJa: '1·デジタル広告' }, undefined)).toBe('1·디지털 광고')
  })

  it('DB 에 없으면 기존 번역으로 돌아간다', () => {
    expect(serviceLabel(1, 'ko', undefined, '디지털 광고 / SNS')).toBe('1. 디지털 광고 / SNS')
  })

  it('이름이 빈 문자열이면 폴백을 쓴다', () => {
    expect(serviceLabel(2, 'ko', { nameKo: '   ', nameJa: '   ' }, '국내·현지 촬영')).toBe('2. 국내·현지 촬영')
  })

  it('DB 도 번역도 없으면 빈 자리를 표시한다', () => {
    // 지워진 서비스의 옛 주문 — 화면이 깨지는 대신 가로줄만 보인다
    expect(serviceLabel(9, 'ko', undefined, undefined)).toBe('-')
  })
})
