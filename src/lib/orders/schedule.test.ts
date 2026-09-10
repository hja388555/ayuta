import { describe, expect, it } from 'vitest'
import { mergeScheduleDays, seoulMidnight, toSeoulDay, type ScheduleDays } from './schedule'
import { OrderScheduleChanges } from '../../collections/OrderScheduleChanges'

// 실제 트랜잭션(setOrderSchedule)은 tests/order-schedule.integration.test.ts 가 다룬다.
// 여기서는 DB 없이 판정 로직만 못박는다 — 날짜 절단, 역순 거부, "변경 없음" 판정.

const empty: ScheduleDays = { contractStart: null, contractEnd: null, adStartDate: null }

describe('toSeoulDay', () => {
  it('YYYY-MM-DD 는 그대로 통과한다', () => {
    expect(toSeoulDay('2026-09-10')).toBe('2026-09-10')
  })

  it('빈 값·null 은 미정(null)이다', () => {
    expect(toSeoulDay(null)).toBeNull()
    expect(toSeoulDay(undefined)).toBeNull()
    expect(toSeoulDay('')).toBeNull()
  })

  it('UTC 시각을 Asia/Seoul 기준 그날로 자른다', () => {
    // UTC 2026-09-09 15:00 = Seoul 2026-09-10 00:00 — 한국 관리자가 고른 날은 10일이다
    expect(toSeoulDay(new Date('2026-09-09T15:00:00Z'))).toBe('2026-09-10')
    // UTC 2026-09-09 14:59 은 아직 Seoul 9일
    expect(toSeoulDay(new Date('2026-09-09T14:59:00Z'))).toBe('2026-09-09')
  })

  it('존재하지 않는 날짜와 쓰레기 입력은 undefined 다 (미정과 구분한다)', () => {
    expect(toSeoulDay('2026-02-31')).toBeUndefined()
    expect(toSeoulDay('언젠가')).toBeUndefined()
    expect(toSeoulDay(new Date('nope'))).toBeUndefined()
  })
})

describe('seoulMidnight', () => {
  it('그날 Seoul 자정(=전날 15:00 UTC)을 가리킨다', () => {
    expect(seoulMidnight('2026-09-10').toISOString()).toBe('2026-09-09T15:00:00.000Z')
  })
})

describe('mergeScheduleDays', () => {
  it('처음 정하는 값은 바뀐 것으로 센다', () => {
    const res = mergeScheduleDays(empty, { contractStart: '2026-09-10', contractEnd: '2027-09-09' })
    expect(res.ok).toBe(true)
    if (!res.ok) return
    expect(res.changed).toEqual(['contractStart', 'contractEnd'])
    expect(res.next.contractStart).toBe('2026-09-10')
  })

  it('같은 값을 다시 보내면 바뀐 것이 없다', () => {
    const current: ScheduleDays = { contractStart: '2026-09-10', contractEnd: '2027-09-09', adStartDate: null }
    const res = mergeScheduleDays(current, { contractStart: '2026-09-10', contractEnd: '2027-09-09' })
    expect(res.ok && res.changed).toEqual([])
  })

  it('표현이 달라도 같은 날이면 바뀐 것이 없다', () => {
    const current: ScheduleDays = { ...empty, adStartDate: '2026-09-10' }
    const res = mergeScheduleDays(current, { adStartDate: new Date('2026-09-09T15:00:00Z') })
    expect(res.ok && res.changed).toEqual([])
  })

  it('안 보낸 필드는 건드리지 않는다', () => {
    const current: ScheduleDays = { contractStart: '2026-09-10', contractEnd: null, adStartDate: '2026-10-01' }
    const res = mergeScheduleDays(current, { contractEnd: '2027-09-09' })
    expect(res.ok && res.changed).toEqual(['contractEnd'])
    expect(res.ok && res.next.adStartDate).toBe('2026-10-01')
  })

  it('종료일이 시작일보다 앞서면 거부한다', () => {
    const res = mergeScheduleDays(empty, { contractStart: '2026-09-10', contractEnd: '2026-09-09' })
    expect(res.ok).toBe(false)
    expect(!res.ok && res.reason).toBe('reversed_period')
  })

  it('이미 저장된 시작일과의 조합까지 검증한다', () => {
    const current: ScheduleDays = { ...empty, contractStart: '2026-09-10' }
    // contractEnd 만 보내도 저장된 시작일보다 앞이면 거부돼야 한다
    const res = mergeScheduleDays(current, { contractEnd: '2026-01-01' })
    expect(!res.ok && res.reason).toBe('reversed_period')
  })

  it('같은 날 시작·종료(1일 계약)는 허용한다', () => {
    const res = mergeScheduleDays(empty, { contractStart: '2026-09-10', contractEnd: '2026-09-10' })
    expect(res.ok).toBe(true)
  })

  it('파싱 안 되는 날짜는 미정으로 흘려보내지 않고 거부한다', () => {
    const res = mergeScheduleDays(empty, { contractStart: '2026-13-01' })
    expect(!res.ok && res.reason).toBe('invalid_date')
  })

  it('정해진 날짜를 다시 비우는 것도 변경으로 센다', () => {
    const current: ScheduleDays = { ...empty, adStartDate: '2026-10-01' }
    const res = mergeScheduleDays(current, { adStartDate: null })
    expect(res.ok && res.changed).toEqual(['adStartDate'])
    expect(res.ok && res.next.adStartDate).toBeNull()
  })
})

describe('order-schedule-changes 접근 권한', () => {
  const access = OrderScheduleChanges.access!
  // otp: 소비된 2단계 인증 코드가 창 안에 있는지. admin-otps 조회를 흉내 낸다
  const req = (role: string | null, otp = true) =>
    ({
      req: {
        user: role ? { id: 1, role } : null,
        context: {},
        payload: { find: async () => ({ docs: otp ? [{ id: 1 }] : [] }) },
      },
    }) as never

  it('2단계 인증을 끝낸 관리자만 읽고 만든다', async () => {
    expect(await access.read!(req('manager'))).toBe(true)
    expect(await access.create!(req('manager'))).toBe(true)
    expect(await access.read!(req('customer'))).toBe(false)
    expect(await access.create!(req(null))).toBe(false)
  })

  it('2단계 인증을 안 끝낸 관리자는 읽지도 만들지도 못한다', async () => {
    expect(await access.read!(req('manager', false))).toBe(false)
    expect(await access.create!(req('super', false))).toBe(false)
  })

  it('수정·삭제·잠금해제는 super 에게도 닫혀 있다 (append-only)', () => {
    expect(access.update!(req('super'))).toBe(false)
    expect(access.delete!(req('super'))).toBe(false)
    expect(access.unlock!(req('super'))).toBe(false)
  })

  it('관리자만 admin UI 에 들어간다', () => {
    expect(access.admin!(req('manager'))).toBe(true)
    expect(access.admin!(req('customer'))).toBe(false)
  })
})
