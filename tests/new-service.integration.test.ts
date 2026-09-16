// 새 광고 서비스 만들기(POST /api/admin/services, id 없는 요청)를 실제 서버·DB 앞에서 고정한다.
// 핵심은 번호와 주소를 서버가 정한다는 것 — 관리자가 보내도 무시하고, 지워진 번호는 다시 쓰지 않는다.
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { api, login } from './helpers/server.js'
import { localPayload } from './helpers/localApi.js'

const RUN = Date.now()
const PW = 'NewSvc!2026'
const base = { name: '홍길동', phone: '010-0000-0000', postalCode: '00000', address1: '서울시' }

let superToken: string | undefined
let managerToken: string | undefined
const userIds: number[] = []
const serviceIds: number[] = []

const post = (body: unknown, token?: string) =>
  api('/api/admin/services', {
    method: 'POST',
    body: JSON.stringify(body),
    headers: token ? { Authorization: `JWT ${token}` } : {},
  })

beforeAll(async () => {
  const payload = await localPayload()
  for (const role of ['super', 'manager'] as const) {
    const email = `new-svc-${role}+${RUN}@ayuta.test`
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
})

afterAll(async () => {
  const payload = await localPayload()
  for (const id of serviceIds) await payload.delete({ collection: 'ad-services', id, overrideAccess: true }).catch(() => {})
  for (const id of userIds) await payload.delete({ collection: 'users', id, overrideAccess: true }).catch(() => {})
})

// 이름에 실행 번호를 섞지 않는다 — 숫자가 주소 규칙에 끼어들어 무엇을 검증하는지 흐려진다.
// 서비스는 매번 지우므로 이름이 겹쳐도 된다
const newBody = (over: Record<string, unknown> = {}) => ({
  nameKo: '테스트 신규 서비스',
  nameJa: 'テスト新規サービス',
  model: 'sum',
  contractMode: 'fixed',
  sortOrder: 990,
  active: false,
  ...over,
})

describe('새 광고 서비스 만들기', () => {
  it('로그인하지 않으면 막는다', async () => {
    expect((await post(newBody())).status).toBe(401)
  })

  it('중간관리자는 만들지 못한다', async () => {
    const res = await post(newBody(), managerToken)
    expect(res.status).toBe(403)
    expect((await res.json()).error).toBe('forbidden')
  })

  it('번호는 서버가 정한다 — 이미 쓰는 번호보다 크다', async () => {
    // 「최대 + 1」을 그대로 단정하지 않는다. 다른 통합 테스트도 전용 서비스를 만들었다 지우므로
    // 읽은 순간과 만드는 순간 사이에 최대값이 바뀔 수 있다. 규칙 자체는 단위 테스트가 고정한다
    const payload = await localPayload()
    const before = await payload.find({ collection: 'ad-services', limit: 500, depth: 0, overrideAccess: true })
    const maxNo = before.docs.reduce((m, d) => Math.max(m, d.no as number), 0)

    const res = await post(newBody(), superToken)
    expect(res.status).toBe(200)
    const body = await res.json()
    serviceIds.push(body.id as number)
    expect(body.no).toBeGreaterThan(maxNo)
    expect(before.docs.some((d) => d.no === body.no)).toBe(false)
  })

  it('주소도 서버가 정한다 — 한국어 이름이면 번호를 쓴다', async () => {
    const created = serviceIds[0]!
    const payload = await localPayload()
    const row = await payload.findByID({ collection: 'ad-services', id: created, overrideAccess: true, depth: 0 })
    expect(row.slug).toMatch(/^[a-z0-9-]+$/)
    expect(row.slug).toBe(`service-${row.no}`)
  })

  it('보낸 번호·주소는 무시한다', async () => {
    const res = await post(newBody({ no: 1, slug: 'digital-sns', nameKo: '무시 확인' }), superToken)
    expect(res.status).toBe(200)
    const body = await res.json()
    serviceIds.push(body.id as number)
    expect(body.no).not.toBe(1)
    expect(body.slug).not.toBe('digital-sns')
  })

  it('계산 방식이 없거나 모르는 값이면 거부한다', async () => {
    const { model, ...withoutModel } = newBody()
    void model
    expect((await post(withoutModel, superToken)).status).toBe(400)
    expect((await post(newBody({ model: 'unknown' }), superToken)).status).toBe(400)
  })

  it('새 서비스는 비공개로 시작한다 — 묶음이 빈 화면이 고객에게 먼저 보이면 안 된다', async () => {
    const payload = await localPayload()
    const row = await payload.findByID({ collection: 'ad-services', id: serviceIds[0]!, overrideAccess: true, depth: 0 })
    expect(row.active).toBe(false)
  })
})
