// A6 이미지 관리(띠 이미지)를 실제 서버·DB 앞에서 고정한다: 최고관리자만 올리고 지우며,
// 내용이 이미지가 아니면 거부하고, 올린 이미지는 공개 주소로 내려가고 지우면 사라지는지.
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
// localApi 를 먼저 불러야 한다 — .env 를 읽기 전에 payload config 를 가져오면 secret 누락으로 뜨지 않는다
import { localPayload } from './helpers/localApi.js'
import { BASE, login } from './helpers/server.js'

const RUN = Date.now()
const PW = 'Ayuta!Test-2026'
const SLOT = 'category-1'
const base = { name: '홍길동', phone: '010-0000-0000', postalCode: '00000', address1: '서울시' }
const userIds: number[] = []
const tokens: Record<string, string | undefined> = {}
const auth = (who?: string): Record<string, string> => (who && tokens[who] ? { Authorization: `JWT ${tokens[who]}` } : {})

const PNG = Uint8Array.from(atob('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=='), (c) => c.charCodeAt(0))
const upload = (bytes: Uint8Array, who?: string, name = 'band.png', type = 'image/png') => {
  const fd = new FormData()
  fd.set('file', new Blob([bytes], { type }), name)
  return fetch(`${BASE}/api/admin/images/${SLOT}`, { method: 'POST', body: fd, headers: auth(who) })
}
const remove = (who?: string) => fetch(`${BASE}/api/admin/images/${SLOT}`, { method: 'DELETE', headers: auth(who) })

let existing: { id: number | string } | undefined

beforeAll(async () => {
  const payload = await localPayload()
  // 로컬 DB 에 이미 올려 둔 이미지가 있으면 테스트가 지우므로 건너뛰지 않고 알린다
  existing = (await payload.find({ collection: 'band-images', where: { slot: { equals: SLOT } }, limit: 1, overrideAccess: true })).docs[0]
  for (const [name, role] of [
    ['super', 'super'],
    ['manager', 'manager'],
    ['customer', 'customer'],
  ] as const) {
    const email = `img-${name}+${RUN}@ayuta.test`
    const u = await payload.create({ collection: 'users', data: { email, password: PW, ...base, role }, overrideAccess: true, context: { allowRoleAssignment: true } })
    userIds.push(u.id as number)
    tokens[name] = (await login(email, PW)).token
  }
})

afterAll(async () => {
  const payload = await localPayload()
  await payload.delete({ collection: 'band-images', where: { slot: { equals: SLOT } }, overrideAccess: true }).catch(() => {})
  await payload.db.pool.query('DELETE FROM admin_login_logs WHERE user_id = ANY($1::int[])', [userIds]).catch(() => {})
  for (const id of userIds) await payload.delete({ collection: 'users', id, overrideAccess: true }).catch(() => {})
})

describe('띠 이미지 권한', () => {
  it('비로그인 401, 고객 403, 중간관리자 403', async () => {
    expect((await upload(PNG)).status).toBe(401)
    expect((await upload(PNG, 'customer')).status).toBe(403)
    expect((await upload(PNG, 'manager')).status).toBe(403)
    expect((await remove('manager')).status).toBe(403)
  })

  it('REST 로는 만들 수 없다', async () => {
    const fd = new FormData()
    fd.set('file', new Blob([PNG], { type: 'image/png' }), 'x.png')
    fd.set('_payload', JSON.stringify({ slot: SLOT }))
    const res = await fetch(`${BASE}/api/band-images`, { method: 'POST', body: fd, headers: auth('super') })
    expect(res.status).toBe(403)
  })
})

describe('띠 이미지 올리기·내려받기·삭제', () => {
  it('이미지가 아닌 내용은 이름·MIME 이 PNG 라도 400', async () => {
    const svg = new TextEncoder().encode('<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>')
    expect((await upload(svg, 'super')).status).toBe(400)
  })

  it('최고관리자가 PNG 를 올리면 200, 공개 주소가 image/png 로 내려준다', async () => {
    if (existing) console.warn(`[admin-images] ${SLOT} 에 있던 로컬 이미지를 테스트가 교체합니다`)
    expect((await upload(PNG, 'super')).status).toBe(200)
    // 한 번 더 올려도(교체) 슬롯에 한 장만 남는다
    expect((await upload(PNG, 'super')).status).toBe(200)
    const payload = await localPayload()
    expect((await payload.find({ collection: 'band-images', where: { slot: { equals: SLOT } }, overrideAccess: true })).totalDocs).toBe(1)

    const res = await fetch(`${BASE}/api/band-image/${SLOT}`)
    expect(res.status).toBe(200)
    expect(res.headers.get('content-type')).toBe('image/png')
    expect(res.headers.get('cache-control')).toContain('public')
    expect(new Uint8Array(await res.arrayBuffer())).toEqual(PNG)
  })

  it('삭제하면 공개 주소가 404, 다시 지우면 404', async () => {
    expect((await remove('super')).status).toBe(200)
    expect((await fetch(`${BASE}/api/band-image/${SLOT}`)).status).toBe(404)
    expect((await remove('super')).status).toBe(404)
  })

  it('모르는 슬롯은 404', async () => {
    expect((await fetch(`${BASE}/api/band-image/category-9`)).status).toBe(404)
  })
})
