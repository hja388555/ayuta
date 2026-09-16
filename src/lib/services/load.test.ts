import { describe, expect, it } from 'vitest'
import { formFromRows, type GroupRow, type ItemRow } from './load'

// DB 행 → 주문 화면이 쓰는 폼 정의(CategoryForm) 로 조립하는 단계만 따로 고정한다.
// 화면 컴포넌트(GroupForm·VideoPairsForm)는 손대지 않으므로, 모양이 어긋나면 여기서 잡아야 한다.
const g = (row: Partial<GroupRow> & { key: string }): GroupRow => ({
  multi: false,
  countryTabs: false,
  axis: 'none',
  sortOrder: 10,
  ...row,
})

const i = (row: Partial<ItemRow> & { key: string; groupKey: string }): ItemRow => ({
  priced: true,
  country: null,
  exclusive: false,
  sortOrder: 10,
  ...row,
})

describe('DB 행 → 주문 폼 정의', () => {
  it('묶음과 항목을 순서대로 조립한다', () => {
    const form = formFromRows(
      [g({ key: 'country', multi: true, sortOrder: 10 }), g({ key: 'videoType', multi: true, axis: 'type', sortOrder: 20 })],
      [
        i({ key: 'country-kr', groupKey: 'country', priced: false, sortOrder: 10 }),
        i({ key: 'video-type-company', groupKey: 'videoType', sortOrder: 10 }),
        i({ key: 'video-type-product', groupKey: 'videoType', sortOrder: 20 }),
      ],
    )
    expect(form.groups.map((x) => x.key)).toEqual(['country', 'videoType'])
    expect(form.groups[0]?.items.map((x) => x.key)).toEqual(['country-kr'])
    expect(form.groups[1]?.items.map((x) => x.key)).toEqual(['video-type-company', 'video-type-product'])
  })

  it('순서 값이 뒤섞여 들어와도 순서대로 정렬한다', () => {
    const form = formFromRows(
      [g({ key: 'b', sortOrder: 20 }), g({ key: 'a', sortOrder: 10 })],
      [
        i({ key: 'a2', groupKey: 'a', sortOrder: 20 }),
        i({ key: 'a1', groupKey: 'a', sortOrder: 10 }),
        i({ key: 'b1', groupKey: 'b', sortOrder: 10 }),
      ],
    )
    expect(form.groups.map((x) => x.key)).toEqual(['a', 'b'])
    expect(form.groups[0]?.items.map((x) => x.key)).toEqual(['a1', 'a2'])
  })

  it('금액 없는 항목과 혼자 선택 항목을 구분해 옮긴다', () => {
    const form = formFromRows(
      [g({ key: 'poster', multi: true })],
      [
        i({ key: 'poster-make', groupKey: 'poster' }),
        i({ key: 'poster-skip', groupKey: 'poster', exclusive: true, sortOrder: 20 }),
        i({ key: 'country-kr', groupKey: 'poster', priced: false, sortOrder: 30 }),
      ],
    )
    const items = form.groups[0]!.items
    expect(items.find((x) => x.key === 'poster-skip')?.exclusive).toBe(true)
    expect(items.find((x) => x.key === 'country-kr')?.priced).toBe(false)
    // 혼자 선택이 아닌 항목에는 exclusive 를 붙이지 않는다(기존 정의와 같은 모양)
    expect(items.find((x) => x.key === 'poster-make')?.exclusive).toBeUndefined()
  })

  it('국가 값이 있으면 항목에 그대로 남고, 묶음에 하나라도 있으면 탭을 켠다', () => {
    const form = formFromRows(
      [g({ key: 'national', multi: true, countryTabs: true })],
      [
        i({ key: 'hankyung', groupKey: 'national', country: 'kr' }),
        i({ key: 'yomiuri', groupKey: 'national', country: 'jp', sortOrder: 20 }),
      ],
    )
    expect(form.countryTabs).toBe(true)
    expect(form.groups[0]?.items[0]?.country).toBe('kr')
    expect(form.groups[0]?.items[1]?.country).toBe('jp')
  })

  it('묶음에 연결된 항목이 없으면 그 묶음은 빼고 그린다', () => {
    // 단가 행이 지워졌거나 아직 안 심긴 묶음이 빈 칸으로 남으면 화면에 제목만 뜬다
    const form = formFromRows([g({ key: 'empty' }), g({ key: 'filled', sortOrder: 20 })], [i({ key: 'x', groupKey: 'filled' })])
    expect(form.groups.map((x) => x.key)).toEqual(['filled'])
  })
})
