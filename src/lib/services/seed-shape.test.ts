import { describe, expect, it } from 'vitest'
import { servicesFromConstants } from './seed-shape'

// 기존 1~5번을 DB 로 옮기기 전에, 상수에서 행 모양으로 바꾸는 단계만 따로 고정한다.
// 여기서 어긋나면 시드가 화면과 다른 구조를 심고, 그 뒤 계산기가 조용히 단가를 못 찾는다.
describe('상수 → 서비스 행 변환', () => {
  it('5개 서비스를 번호·주소·계산 방식과 함께 만든다', () => {
    const rows = servicesFromConstants()
    expect(rows.map((r) => r.no)).toEqual([1, 2, 3, 4, 5])
    expect(rows.find((r) => r.no === 1)?.slug).toBe('digital-sns')
    expect(rows.find((r) => r.no === 1)?.model).toBe('tier')
    expect(rows.find((r) => r.no === 2)?.model).toBe('videoPairs')
    expect(rows.find((r) => r.no === 4)?.model).toBe('sumMultiplier')
    expect(rows.find((r) => r.no === 5)?.model).toBe('inquiry')
  })

  it('계약서 방식은 5번만 견적 발행 때 작성이다', () => {
    const rows = servicesFromConstants()
    expect(rows.find((r) => r.no === 4)?.contractMode).toBe('fixed')
    expect(rows.find((r) => r.no === 5)?.contractMode).toBe('perQuote')
  })

  it('메인 목록 순서는 번호 차례를 따른다', () => {
    const rows = servicesFromConstants()
    expect(rows.map((r) => r.sortOrder)).toEqual([10, 20, 30, 40, 50])
  })

  it('4번은 광고 기간 키를 함께 옮긴다', () => {
    const four = servicesFromConstants().find((r) => r.no === 4)
    expect(four?.periods?.map((p) => p.key)).toEqual(['1w', '2w', '1m', '3m'])
    // 배수 값은 관리자가 저장한 값이라 시드 실행 때 채운다 — 변환 단계에서는 0
    expect(four?.periods?.every((p) => p.multiplier === 0)).toBe(true)
  })

  it('묶음은 중복 선택·국가 탭·축 정보를 그대로 옮긴다', () => {
    const groups = servicesFromConstants().flatMap((r) => r.groups)
    const videoType = groups.find((g) => g.key === 'videoType')
    expect(videoType?.multi).toBe(true)
    expect(videoType?.axis).toBe('type')
    const videoLength = groups.find((g) => g.key === 'videoLength')
    expect(videoLength?.multi).toBe(false)
    expect(videoLength?.axis).toBe('length')
  })

  it('한국/일본 탭을 쓰는 묶음은 표시가 남는다', () => {
    const rows = servicesFromConstants()
    const three = rows.find((r) => r.no === 3)!
    expect(three.groups.some((g) => g.countryTabs)).toBe(true)
  })

  it('항목은 금액 여부·국가·혼자 선택을 그대로 옮긴다', () => {
    const groups = servicesFromConstants().flatMap((r) => r.groups)
    const country = groups.find((g) => g.key === 'country')!
    expect(country.items.every((i) => i.priced === false)).toBe(true)
    const all = groups.flatMap((g) => g.items)
    expect(all.some((i) => i.country === 'kr')).toBe(true)
    expect(all.some((i) => i.exclusive)).toBe(true)
  })

  it('묶음·항목 순서는 화면에 나오는 차례대로 번호를 매긴다', () => {
    const first = servicesFromConstants().find((r) => r.no === 2)!
    expect(first.groups.map((g) => g.sortOrder)).toEqual(first.groups.map((_, i) => (i + 1) * 10)) // 10, 20, 30…
    expect(first.groups[0]?.items.map((i) => i.sortOrder)).toEqual(first.groups[0]?.items.map((_, i) => (i + 1) * 10))
  })
})
