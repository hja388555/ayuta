// 묶음·항목 저장 API(/api/admin/service-groups, /api/admin/service-items)를 실제 서버·DB 앞에서 고정한다.
// 핵심은 셋이다 — 권한 경계, 못 바꾸는 값(묶음 키·서비스), 항목 키를 서버가 만든다는 것.
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { api, login } from './helpers/server.js'
import { localPayload } from './helpers/localApi.js'

const RUN = Date.now()
const PW = 'SvcGroup!2026'
const base = { name: '홍길동', phone: '010-0000-0000', postalCode: '00000', address1: '서울시' }

let superToken: string | undefined
let managerToken: string | undefined
let serviceId: number
let serviceNo: number
let groupId: number
const userIds: number[] = []
const itemIds: number[] = []

const post = (path: string, body: unknown, token?: string) =>
  api(path, {
    method: 'POST',
    body: JSON.stringify(body),
    headers: token ? { Authorization: `JWT ${token}` } : {},
  })

beforeAll(async () => {
  const payload = await localPayload()
  for (const role of ['super', 'manager'] as const) {
    const email = `grp-${role}+${RUN}@ayuta.test`
    const u = await payload.create({
      collection: 'users',
      data: { email, password: PW, ...base, role },
      overrideAccess: true,
      context: { allowRoleAssignment: true },
    })
    userIds.push(u.id as number)
    const token = (await login(email, PW)).token
    if (role === 'super') superToken = token
    else managerToken = token
  }

  // 기존 1~5번을 건드리지 않도록 이 테스트 전용 서비스를 쓴다
  serviceNo = 800 + (RUN % 90)
  const created = await payload.create({
    collection: 'ad-services',
    data: {
      no: serviceNo,
      slug: `grp-test-${RUN}`,
      nameKo: '묶음 테스트',
      nameJa: 'グループテスト',
      model: 'sum',
      contractMode: 'fixed',
      sortOrder: 800,
      active: true,
    },
    overrideAccess: true,
  })
  serviceId = created.id as number
})

afterAll(async () => {
  const payload = await localPayload()
  for (const id of itemIds) await payload.delete({ collection: 'price-entries', id, overrideAccess: true }).catch(() => {})
  if (groupId) await payload.delete({ collection: 'ad-service-groups', id: groupId, overrideAccess: true }).catch(() => {})
  await payload.delete({ collection: 'ad-services', id: serviceId, overrideAccess: true }).catch(() => {})
  for (const id of userIds) await payload.delete({ collection: 'users', id, overrideAccess: true }).catch(() => {})
})

const groupBody = (over: Record<string, unknown> = {}) => ({
  serviceId,
  key: 'spot',
  titleKo: '광고 위치 선택',
  titleJa: '広告位置の選択',
  multi: true,
  countryTabs: false,
  axis: 'none',
  sortOrder: 10,
  active: true,
  ...over,
})

describe('관리자 묶음 저장 API', () => {
  it('로그인하지 않으면 막는다', async () => {
    expect((await post('/api/admin/service-groups', groupBody())).status).toBe(401)
  })

  it('중간관리자는 저장하지 못한다', async () => {
    const res = await post('/api/admin/service-groups', groupBody(), managerToken)
    expect(res.status).toBe(403)
    expect((await res.json()).error).toBe('forbidden')
  })

  it('최고관리자는 묶음을 만든다', async () => {
    const res = await post('/api/admin/service-groups', groupBody(), superToken)
    expect(res.status).toBe(200)
    groupId = (await res.json()).id as number
    expect(groupId).toBeGreaterThan(0)
  })

  it('같은 서비스에 같은 키를 또 만들지 못한다', async () => {
    const res = await post('/api/admin/service-groups', groupBody(), superToken)
    expect(res.status).toBe(400)
    expect((await res.json()).error).toBe('group_key_taken')
  })

  it('고칠 때 묶음 키와 서비스는 바뀌지 않는다', async () => {
    const res = await post(
      '/api/admin/service-groups',
      { id: groupId, titleKo: '바뀐 제목', titleJa: '変更', multi: false, countryTabs: true, axis: 'none', sortOrder: 20, active: true, key: 'hacked', serviceId: 999 },
      superToken,
    )
    expect(res.status).toBe(200)

    const payload = await localPayload()
    const after = await payload.findByID({ collection: 'ad-service-groups', id: groupId, overrideAccess: true, depth: 0 })
    expect(after.titleKo).toBe('바뀐 제목')
    expect(after.key).toBe('spot')
    const svc = typeof after.service === 'object' && after.service ? (after.service as { id: number }).id : after.service
    expect(svc).toBe(serviceId)
  })

  it('모르는 축 값은 거부한다', async () => {
    expect((await post('/api/admin/service-groups', groupBody({ axis: 'unknown' }), superToken)).status).toBe(400)
  })
})

const itemBody = (over: Record<string, unknown> = {}) => ({
  groupId,
  labelKo: '강남역 전광판',
  labelJa: '江南駅 電光掲示板',
  priceKrw: 3_000_000,
  priceJpy: 330_000,
  priced: true,
  exclusive: false,
  sortOrder: 10,
  active: true,
  ...over,
})

describe('관리자 항목 저장 API', () => {
  it('중간관리자는 저장하지 못한다', async () => {
    expect((await post('/api/admin/service-items', itemBody(), managerToken)).status).toBe(403)
  })

  it('항목 키는 서버가 서비스 번호와 묶음 키로 만든다', async () => {
    const res = await post('/api/admin/service-items', itemBody(), superToken)
    expect(res.status).toBe(200)
    const body = await res.json()
    itemIds.push(body.id as number)
    expect(body.key).toBe(`s${serviceNo}-spot-1`)
  })

  it('같은 묶음에 또 만들면 다음 번호를 쓴다', async () => {
    const res = await post('/api/admin/service-items', itemBody({ labelKo: '홍대입구 전광판', sortOrder: 20 }), superToken)
    expect(res.status).toBe(200)
    const body = await res.json()
    itemIds.push(body.id as number)
    expect(body.key).toBe(`s${serviceNo}-spot-2`)
  })

  it('항목은 묶음이 속한 서비스 번호로 저장된다', async () => {
    const payload = await localPayload()
    const row = await payload.findByID({ collection: 'price-entries', id: itemIds[0]!, overrideAccess: true, depth: 0 })
    expect(Number(row.category)).toBe(serviceNo)
    expect(row.priceKrw).toBe(3_000_000)
  })

  it('고칠 때 키는 바뀌지 않는다', async () => {
    const res = await post(
      '/api/admin/service-items',
      { id: itemIds[0], labelKo: '이름만 바꿈', labelJa: '名前変更', priceKrw: 1_000, priceJpy: 100, priced: true, exclusive: false, sortOrder: 15, active: true, key: 'hacked' },
      superToken,
    )
    expect(res.status).toBe(200)

    const payload = await localPayload()
    const after = await payload.findByID({ collection: 'price-entries', id: itemIds[0]!, overrideAccess: true, depth: 0 })
    expect(after.key).toBe(`s${serviceNo}-spot-1`)
    expect(after.labelKo).toBe('이름만 바꿈')
    expect(after.priceKrw).toBe(1_000)
  })

  it('소수·음수 금액은 거부한다', async () => {
    expect((await post('/api/admin/service-items', itemBody({ priceKrw: 1000.5 }), superToken)).status).toBe(400)
    expect((await post('/api/admin/service-items', itemBody({ priceJpy: -1 }), superToken)).status).toBe(400)
  })
})
