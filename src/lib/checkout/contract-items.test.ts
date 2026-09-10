import { describe, expect, it } from 'vitest'
import type { PriceBook } from '@ayuta/pricing'
import { buildContractItems, countryFactValue } from './contract-items'
import { CATEGORIES } from '../categories'

const emptyBook: PriceBook = { currency: 'KRW', entries: {} }

describe('countryFactValue — 1번 계약서 {{country}}', () => {
  it('고른 나라를 원본 표기 순서(한국, 일본)로 렌더링한다', () => {
    expect(countryFactValue({ country: ['jp', 'kr'] }, 'ko')).toBe('한국, 일본')
  })

  it('하나만 고르면 그것만 찍는다', () => {
    expect(countryFactValue({ country: ['jp'] }, 'ko')).toBe('일본')
  })

  it('나라가 없으면 명시적 대시를 채운다 — undefined로 비워 두면 missing 판정을 유발한다', () => {
    expect(countryFactValue({}, 'ko')).toBe('-')
  })
})

describe('buildContractItems — 4번(지하철·버스·블로그) 광고 국가', () => {
  const def4 = CATEGORIES.find((c) => c.no === 4)!

  it('4번은 G절 자동 채움 목록대로 광고 국가 항목을 items에 싣는다', () => {
    const items = buildContractItems(def4, emptyBook, { items: [], country: ['jp', 'kr'] }, 'ko')
    expect(items).toContainEqual({ label: '광고 국가', value: '한국, 일본' })
  })

  it('나라를 안 골랐으면 광고 국가 항목을 넣지 않는다', () => {
    const items = buildContractItems(def4, emptyBook, { items: [] }, 'ko')
    expect(items.some((i) => i.label === '광고 국가')).toBe(false)
  })
})

describe('buildContractItems — 2번은 촬영 국가라는 별개 필드다 (광고 국가를 섞지 않는다)', () => {
  const def2 = CATEGORIES.find((c) => c.no === 2)!

  it('2번은 country 셀렉션이 있어도 "광고 국가" 라벨을 만들지 않는다', () => {
    const items = buildContractItems(def2, emptyBook, { items: [], country: ['jp'] }, 'ko')
    expect(items.some((i) => i.label === '광고 국가')).toBe(false)
  })
})
