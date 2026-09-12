import { describe, expect, it } from 'vitest'
import { minor, type PriceBook } from '@ayuta/pricing'
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

describe('buildContractItems — 3번(대표신문·지역신문·블로그) 광고 국가', () => {
  const def3 = CATEGORIES.find((c) => c.no === 3)!

  it('3번은 H절 "계약 및 광고 신청정보" 대로 광고 국가 항목을 items에 싣는다', () => {
    const items = buildContractItems(def3, emptyBook, { items: [], country: ['jp', 'kr'] }, 'ko')
    expect(items).toContainEqual({ label: '광고 국가', value: '한국, 일본' })
  })

  it('일본어 계약서에는 일본어 라벨로 싣는다', () => {
    const items = buildContractItems(def3, emptyBook, { items: [], country: ['kr'] }, 'ja')
    expect(items.some((i) => i.label === '広告国')).toBe(true)
  })

  it('나라를 안 골랐으면 광고 국가 항목을 넣지 않는다', () => {
    const items = buildContractItems(def3, emptyBook, { items: [] }, 'ko')
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

describe('buildContractItems — 2번 영상별 줄', () => {
  const def2 = CATEGORIES.find((c) => c.no === 2)!

  it('촬영 국가 한 줄 뒤에 영상마다 한 줄씩 싣고, 금액은 섞지 않는다', () => {
    const items = buildContractItems(
      def2,
      emptyBook,
      {
        items: ['country-kr'],
        pairs: [
          { type: 'video-type-company', length: 'video-length-10m' },
          { type: 'video-type-product', length: 'video-length-10m' },
        ],
      },
      'ko',
    )
    expect(items).toEqual([
      { label: '촬영 국가', value: '한국 현지 촬영' },
      { label: '영상 1', value: 'video-type-company · video-length-10m' },
      { label: '영상 2', value: 'video-type-product · video-length-10m' },
    ])
  })

  it('단가 묶음의 라벨을 쓰고, 일본어 계약서에는 일본어 줄 이름을 쓴다', () => {
    const book: PriceBook = {
      currency: 'JPY',
      entries: {
        'video-type-event': { key: 'video-type-event', label: 'イベント', amount: minor(1) },
        'video-length-60m': { key: 'video-length-60m', label: '60分', amount: minor(1) },
      },
    }
    const items = buildContractItems(def2, book, { pairs: [{ type: 'video-type-event', length: 'video-length-60m' }] }, 'ja')
    expect(items).toEqual([{ label: '映像 1', value: 'イベント · 60分' }])
  })
})
