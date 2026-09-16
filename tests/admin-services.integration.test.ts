// 관리자 광고 서비스 저장 API(/api/admin/services)를 실제 서버·DB 앞에서 고정한다.
// 바꿀 수 있는 값이 좁다는 것(번호·주소·계산 방식은 못 바꾼다)과 권한 경계가 핵심이다.
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { api, login } from './helpers/server.js'
import { localPayload } from './helpers/localApi.js'

const RUN = Date.now()
const PW = 'AdminSvc!2026'
// 다른 통합 테스트와 같은 기본 값 — 우편번호·주소는 필수다
const base = { name: '홍길동', phone: '010-0000-0000', postalCode: '00000', address1: '서울시' }

let superToken: string | undefined
let managerToken: string | undefined
let serviceId: number
const userIds: number[] = []

const post = (body: unknown, token?: string) =>
  api('/api/admin/services', {
    method: 'POST',
    body: JSON.stringify(body),
    headers: token ? { Authorization: `JWT ${token}` } : {},
  })

beforeAll(async () => {
  const payload = await localPayload()
  for (const role of ['super', 'manager'] as const) {
    const email = `svc-${role}+${RUN}@ayuta.test`
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

  // 기존 서비스를 건드리지 않도록 이 테스트 전용 서비스를 만든다
  const created = await payload.create({
    collection: 'ad-services',
    data: {
      no: 900 + (RUN % 90),
      slug: `svc-test-${RUN}`,
      nameKo: '테스트 서비스',
      nameJa: 'テストサービス',
      model: 'sum',
      contractMode: 'fixed',
      sortOrder: 900,
      active: true,
    },
    overrideAccess: true,
  })
  serviceId = created.id as number
})

afterAll(async () => {
  const payload = await localPayload()
  await payload.delete({ collection: 'ad-services', id: serviceId, overrideAccess: true }).catch(() => {})
  for (const id of userIds) await payload.delete({ collection: 'users', id, overrideAccess: true }).catch(() => {})
})

const validBody = (over: Record<string, unknown> = {}) => ({
  id: serviceId,
  nameKo: '이름 바꿈',
  nameJa: '名前変更',
  contractMode: 'fixed',
  sortOrder: 910,
  active: true,
  ...over,
})

describe('관리자 광고 서비스 저장 API', () => {
  it('로그인하지 않으면 막는다', async () => {
    expect((await post(validBody())).status).toBe(401)
  })

  it('중간관리자는 저장하지 못한다 — 조회만 한다', async () => {
    const res = await post(validBody(), managerToken)
    expect(res.status).toBe(403)
    expect((await res.json()).error).toBe('forbidden')
  })

  it('최고관리자는 이름·순서·공개 여부를 바꾼다', async () => {
    const res = await post(validBody({ nameKo: '바뀐 이름', sortOrder: 920, active: false }), superToken)
    expect(res.status).toBe(200)

    const payload = await localPayload()
    const after = await payload.findByID({ collection: 'ad-services', id: serviceId, overrideAccess: true, depth: 0 })
    expect(after.nameKo).toBe('바뀐 이름')
    expect(after.sortOrder).toBe(920)
    expect(after.active).toBe(false)
  })

  it('번호·주소·계산 방식은 이 경로로 바뀌지 않는다', async () => {
    const payload = await localPayload()
    const before = await payload.findByID({ collection: 'ad-services', id: serviceId, overrideAccess: true, depth: 0 })
    const res = await post({ ...validBody(), no: 1, slug: 'digital-sns', model: 'tier' }, superToken)
    expect(res.status).toBe(200)

    const after = await payload.findByID({ collection: 'ad-services', id: serviceId, overrideAccess: true, depth: 0 })
    expect(after.no).toBe(before.no)
    expect(after.slug).toBe(before.slug)
    expect(after.model).toBe(before.model)
  })

  it('빈 이름이나 모르는 계약서 방식은 거부한다', async () => {
    expect((await post(validBody({ nameKo: '' }), superToken)).status).toBe(400)
    expect((await post(validBody({ contractMode: 'unknown' }), superToken)).status).toBe(400)
  })
})
