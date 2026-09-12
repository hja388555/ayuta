import { describe, expect, it } from 'vitest'
import { contractItemDictionary, localizeContractItems } from './localize-items'

const krwBook = { currency: 'KRW', entries: { premium: { key: 'premium', label: '프리미엄', amount: 1 }, standard: { key: 'standard', label: '스탠다드', amount: 1 } } } as never
const jpyBook = { currency: 'JPY', entries: { premium: { key: 'premium', label: 'プレミアム', amount: 1 }, standard: { key: 'standard', label: 'スタンダード', amount: 1 } } } as never

describe('localizeContractItems', () => {
  it('한국어로 저장된 1번 주문을 일본어 화면에서 라벨·값 모두 일본어로 보여 준다', () => {
    const dict = contractItemDictionary('ko', 'ja', { from: krwBook, to: jpyBook })
    const out = localizeContractItems(
      [
        { label: '등급', value: '프리미엄, 스탠다드' },
        { label: '플랫폼', value: '인스타그램, 유튜브, 틱톡, LINE' },
        { label: '광고 국가', value: '한국, 일본' },
      ],
      dict,
    )
    expect(out).toEqual([
      { label: 'グレード', value: 'プレミアム, スタンダード' },
      { label: 'プラットフォーム', value: 'Instagram, YouTube, TikTok, LINE' },
      { label: '広告国', value: '韓国, 日本' },
    ])
  })

  it('일본어 주문이라도 한국어로 박힌 "등급" 라벨은 일본어 화면에서 바뀐다', () => {
    const out = localizeContractItems([{ label: '등급', value: 'プレミアム' }], contractItemDictionary('ja', 'ja'))
    expect(out).toEqual([{ label: 'グレード', value: 'プレミアム' }])
  })

  it('한국어 화면은 그대로이고, 사전에 없는 말은 원문을 둔다', () => {
    const dict = contractItemDictionary('ko', 'ko', { from: krwBook, to: krwBook })
    expect(localizeContractItems([{ label: '등급', value: '프리미엄' }], dict)).toEqual([{ label: '등급', value: '프리미엄' }])
    const ja = contractItemDictionary('ko', 'ja')
    expect(localizeContractItems([{ label: '견적번호', value: '관리자가 바꾼 이름 · 10분' }], ja)).toEqual([{ label: '견적번호', value: '관리자가 바꾼 이름 · 10분' }])
  })
})
