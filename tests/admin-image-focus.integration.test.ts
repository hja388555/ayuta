// A6-B 띠 위치 조정을 실제 서버·DB 앞에서 고정한다: 최고관리자만 저장하고, 값은 0~100 정수만 받으며,
// 저장한 위치가 서비스 페이지 띠에 object-position 으로 바로 반영되고, 교체하면 가운데로 돌아가는지.
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
// localApi 를 먼저 불러야 한다 — .env 를 읽기 전에 payload config 를 가져오면 secret 누락으로 뜨지 않는다
import { localPayload } from './helpers/localApi.js'
import { BASE, login } from './helpers/server.js'

const RUN = Date.now()
const PW = 'Ayuta!Test-2026'
const SLOT = 'category-2'
const PAGE = '/ko/order/local-video'
const base = { name: '홍길동', phone: '010-0000-0000', postalCode: '00000', address1: '서울시' }
const userIds: number[] = []
const tokens: Record<string, string | undefined> = {}
const auth = (who?: string): Record<string, string> => (who && tokens[who] ? { Authorization: `JWT ${tokens[who]}` } : {})

const PNG = Uint8Array.from(atob('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=='), (c) => c.charCodeAt(0))
const upload = (who: string) => {
  const fd = new FormData()
  fd.set('file', new Blob([PNG], { type: 'image/png' }), 'band.png')
  return fetch(`${BASE}/api/admin/images/${SLOT}`, { method: 'POST', body: fd, headers: auth(who) })
}
const patch = (body: unknown, who?: string, slot = SLOT) =>
  fetch(`${BASE}/api/admin/images/${slot}`, {
    method: 'PATCH',
    body: typeof body === 'string' ? body : JSON.stringify(body),
    headers: { 'Content-Type': 'application/json', ...auth(who) },
  })

/** 서비스 페이지 띠 <img> 의 세로 위치(%)와 ?v= 값 */
async function bandOnPage(): Promise<{ y: number; v: string } | null> {
  const html = await (await fetch(`${BASE}${PAGE}`)).text()
  const tag = html.match(/<img[^>]*class="image-band"[^>]*>/)?.[0]
  if (!tag) return null
  const y = tag.match(/object-position:50% (\d+)%/)?.[1]
  const v = tag.match(/band-image\/category-2\?v=([^"&]+)/)?.[1]
  return { y: Number(y), v: String(v) }
}

const storedFocus = async () => {
  const payload = await localPayload()
  return (await payload.find({ collection: 'band-images', where: { slot: { equals: SLOT } }, limit: 1, overrideAccess: true })).docs[0]?.focusY
}

beforeAll(async () => {
  const payload = await localPayload()
  const existing = (await payload.find({ collection: 'band-images', where: { slot: { equals: SLOT } }, limit: 1, overrideAccess: true })).docs[0]
  if (existing) console.warn(`[admin-image-focus] ${SLOT} 에 있던 로컬 이미지를 테스트가 교체합니다`)
  for (const [name, role] of [
    ['super', 'super'],
    ['manager', 'manager'],
  ] as const) {
    const email = `focus-${name}+${RUN}@ayuta.test`
    const u = await payload.create({ collection: 'users', data: { email, password: PW, ...base, role }, overrideAccess: true, context: { allowRoleAssignment: true } })
    userIds.push(u.id as number)
    tokens[name] = (await login(email, PW)).token
  }
  expect((await upload('super')).status).toBe(200)
})

afterAll(async () => {
  const payload = await localPayload()
  await payload.delete({ collection: 'band-images', where: { slot: { equals: SLOT } }, overrideAccess: true }).catch(() => {})
  await payload.db.pool.query('DELETE FROM admin_login_logs WHERE user_id = ANY($1::int[])', [userIds]).catch(() => {})
  for (const id of userIds) await payload.delete({ collection: 'users', id, overrideAccess: true }).catch(() => {})
})

describe('띠 위치 권한', () => {
  it('비로그인 401, 중간관리자 403 — 값은 그대로', async () => {
    expect((await patch({ focusY: 10 })).status).toBe(401)
    expect((await patch({ focusY: 10 }, 'manager')).status).toBe(403)
    expect(await storedFocus()).toBe(50)
  })
})

describe('띠 위치 저장', () => {
  it('새로 올린 이미지는 가운데(50%)로 보인다', async () => {
    expect((await bandOnPage())?.y).toBe(50)
  })

  it('최고관리자가 저장하면 서비스 페이지 띠 위치와 ?v= 가 바뀐다', async () => {
    const before = await bandOnPage()
    const res = await patch({ focusY: 30 }, 'super')
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ ok: true, focusY: 30 })
    expect(await storedFocus()).toBe(30)
    const after = await bandOnPage()
    expect(after?.y).toBe(30)
    expect(after?.v).not.toBe(before?.v)
  })

  it('0·100 끝값도 받는다', async () => {
    expect((await patch({ focusY: 0 }, 'super')).status).toBe(200)
    expect((await patch({ focusY: 100 }, 'super')).status).toBe(200)
    expect((await bandOnPage())?.y).toBe(100)
  })

  it('범위 밖·소수·문자열·빈 값·깨진 JSON 은 400', async () => {
    for (const body of [{ focusY: 101 }, { focusY: -1 }, { focusY: 12.5 }, { focusY: '50' }, {}, null]) {
      const res = await patch(body, 'super')
      expect(res.status).toBe(400)
      expect((await res.json()).error).toBe('invalid_band_focus')
    }
    expect((await patch('{focusY:', 'super')).status).toBe(400)
    expect(await storedFocus()).toBe(100)
  })

  it('이미지를 교체하면 가운데(50%)로 돌아간다', async () => {
    expect((await patch({ focusY: 20 }, 'super')).status).toBe(200)
    expect((await upload('super')).status).toBe(200)
    expect(await storedFocus()).toBe(50)
    expect((await bandOnPage())?.y).toBe(50)
  })

  it('빈 슬롯·모르는 슬롯은 404', async () => {
    expect((await fetch(`${BASE}/api/admin/images/${SLOT}`, { method: 'DELETE', headers: auth('super') })).status).toBe(200)
    const res = await patch({ focusY: 40 }, 'super')
    expect(res.status).toBe(404)
    expect((await res.json()).error).toBe('band_image_not_found')
    expect((await patch({ focusY: 40 }, 'super', 'category-9')).status).toBe(404)
  })
})
