import { describe, expect, it } from 'vitest'
import { formatJpZip, mapZipcloud, normalizeJpZip } from './address'

describe('normalizeJpZip', () => {
  it.each([
    ['123-4567', '1234567'],
    ['1234567', '1234567'],
    [' 100-0001 ', '1000001'],
    ['１２３－４５６７', '1234567'],
  ])('%s → %s', (input, out) => expect(normalizeJpZip(input)).toBe(out))

  it.each(['', '123456', '12345678', '12-34567', '123 4567', 'abc-defg', '1234567&x=1', '06236'])('거절: %s', (input) =>
    expect(normalizeJpZip(input)).toBeNull(),
  )

  it('formatJpZip', () => expect(formatJpZip('1234567')).toBe('123-4567'))
})

describe('mapZipcloud', () => {
  it('정상 응답을 카드로 바꾼다', () => {
    const json = {
      status: 200,
      message: null,
      results: [
        { address1: '東京都', address2: '千代田区', address3: '千代田', kana1: 'ﾄｳｷｮｳﾄ', prefcode: '13', zipcode: '1000001' },
        { address1: '北海道', address2: '札幌市中央区', address3: '', prefcode: '1', zipcode: '0600000' },
      ],
    }
    expect(mapZipcloud(json)).toEqual([
      { postalCode: '100-0001', prefecture: '東京都', city: '千代田区', town: '千代田', address: '東京都千代田区千代田' },
      { postalCode: '060-0000', prefecture: '北海道', city: '札幌市中央区', town: '', address: '北海道札幌市中央区' },
    ])
  })

  it('결과 없음·오류·이상한 행은 빈 배열/제외', () => {
    expect(mapZipcloud({ status: 200, results: null })).toEqual([])
    expect(mapZipcloud({ status: 400, message: 'bad' })).toEqual([])
    expect(mapZipcloud(null)).toEqual([])
    expect(mapZipcloud({ results: [{ zipcode: 'x', address1: '東京都' }, { zipcode: '1000001' }] })).toEqual([])
  })
})
