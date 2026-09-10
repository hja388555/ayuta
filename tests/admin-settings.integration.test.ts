// 관리자 설정(큐 Q25)을 실제 서버·DB 앞에서 고정한다: 회사 정보를 바꾸면 푸터와 새 계약서에
// 반영되는지, 서명·날인은 투명 PNG 만 받는지, 권한 변경·계정 생성이 최고관리자에게만 있는지.
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
// localApi 를 먼저 불러야 한다 — .env(PAYLOAD_SECRET 등)를 읽어 두기 전에 payload config 를
// 가져오면 "missing secret key" 로 파일 전체가 뜨지 않는다(createOrder 가 config 를 끌어온다)
import { localPayload } from './helpers/localApi.js'
import { BASE, api, login } from './helpers/server.js'
import { createOrder } from '../src/lib/checkout/create-order'

const RUN = Date.now()
const PW = 'Ayuta!Test-2026'
const base = { name: '홍길동', phone: '010-0000-0000', postalCode: '00000', address1: '서울시' }
const userIds: number[] = []
const orderIds: number[] = []
const tokens: Record<string, string | undefined> = {}
let original: Record<string, unknown>
const auth = (who?: string): Record<string, string> => (who && tokens[who] ? { Authorization: `JWT ${tokens[who]}` } : {})
const post = (path: string, body: unknown, who?: string) => api(path, { method: 'POST', headers: auth(who), body: JSON.stringify(body) })

// RGBA(6) 1×1 PNG, RGB(2) 1×1 PNG
const RGBA_PNG = Uint8Array.from(atob('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=='), (c) => c.charCodeAt(0))
const RGB_PNG = Uint8Array.from(atob('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAIAAACQd1PeAAAADElEQVR4nGP4z8AAAAMBAQDJ/pLvAAAAAElFTkSuQmCC'), (c) => c.charCodeAt(0))
const uploadSeal = (bytes: Uint8Array, who?: string) => {
  const fd = new FormData()
  fd.set('file', new Blob([bytes], { type: 'image/png' }), 'seal.png')
  return fetch(`${BASE}/api/admin/settings/seal`, { method: 'POST', body: fd, headers: auth(who) })
}

const settingsBody = (over: Record<string, string> = {}) => ({
  nameKo: 'AYUTA(아유타)',
  nameJa: 'AYUTA(アユタ)',
  ceo: '황지원',
  businessNo: '259-23-02007',
  addressKo: '서울특별시 동대문구 답십리동 323',
  addressJa: 'ソウル特別市東大門区踏十里洞323',
  phone: '02-3394-8838',
  email: 'gggwon@gmail.com',
  contactPhone: '',
  mailOrderNo: '',
  ...over,
})

beforeAll(async () => {
  const payload = await localPayload()
  original = (await payload.findGlobal({ slug: 'company-settings', depth: 0, overrideAccess: true })) as unknown as Record<string, unknown>
  for (const [name, role] of [
    ['super', 'super'],
    ['manager', 'manager'],
    ['customer', 'customer'],
  ] as const) {
    const email = `set-${name}+${RUN}@ayuta.test`
    const u = await payload.create({ collection: 'users', data: { email, password: PW, ...base, role }, overrideAccess: true, context: { allowRoleAssignment: true } })
    userIds.push(u.id as number)
    tokens[name] = (await login(email, PW)).token
  }
})

afterAll(async () => {
  const payload = await localPayload()
  const { id: _id, createdAt: _c, updatedAt: _u, globalType: _g, ...rest } = original as Record<string, unknown>
  await payload.updateGlobal({ slug: 'company-settings', data: rest, overrideAccess: true }).catch(() => {})
  for (const id of orderIds) await payload.delete({ collection: 'orders', id, overrideAccess: true }).catch(() => {})
  await payload.db.pool.query('DELETE FROM admin_login_logs WHERE user_id = ANY($1::int[])', [userIds]).catch(() => {})
  const { docs } = await payload.find({ collection: 'users', where: { email: { like: `+${RUN}@` } }, limit: 100, overrideAccess: true })
  for (const d of docs) await payload.delete({ collection: 'users', id: d.id, overrideAccess: true }).catch(() => {})
  for (const id of userIds) await payload.delete({ collection: 'users', id, overrideAccess: true }).catch(() => {})
})

describe('회사 정보 설정', () => {
  it('저장은 최고관리자만 — 비로그인 401, 고객·중간관리자 403', async () => {
    expect((await post('/api/admin/settings', settingsBody())).status).toBe(401)
    expect((await post('/api/admin/settings', settingsBody(), 'customer')).status).toBe(403)
    expect((await post('/api/admin/settings', settingsBody(), 'manager')).status).toBe(403)
  })

  it('바꾸면 푸터와 새 계약서에 바로 반영된다', async () => {
    const res = await post('/api/admin/settings', settingsBody({ phone: '02-9999-0000', contactPhone: '010-1212-3434', mailOrderNo: `제2026-테스트-${RUN}호` }), 'super')
    expect(res.status).toBe(200)

    const html = await (await api('/ko')).text()
    expect(html).toContain('02-9999-0000')
    expect(html).toContain('010-1212-3434')
    expect(html).toContain(`제2026-테스트-${RUN}호`)

    const r = await createOrder({
      categorySlug: 'digital-sns',
      locale: 'ko',
      selection: { tiers: ['standard'], platforms: [], country: ['kr'] },
      consents: { agree: true },
      orderer: { name: `설정고객${RUN}`, phone: '010-1234-5678', email: `set-order+${RUN}@example.com`, postalCode: '12345', address1: '서울' },
      signature: `설정고객${RUN}`,
    })
    expect(r.ok).toBe(true)
    if (!r.ok) return
    orderIds.push(r.orderId)
    const payload = await localPayload()
    const order = await payload.findByID({ collection: 'orders', id: r.orderId, overrideAccess: true })
    expect(order.contractText as string).toContain('02-9999-0000')
  })

  it('담당자·신고번호를 비우면 푸터에서 그 칸이 빠진다(0000 같은 자리표시를 찍지 않는다)', async () => {
    await post('/api/admin/settings', settingsBody(), 'super')
    const html = await (await api('/ko')).text()
    // 페이지 전체가 아니라 푸터만 본다 — 클라이언트 번역 메시지(푸터 라벨 포함)가 HTML 에 직렬화돼
    // 들어가므로 페이지 전체에서 라벨 문자열을 찾으면 푸터에 없어도 걸린다
    const footer = html.match(/<footer[^>]*data-site-footer[\s\S]*?<\/footer>/)?.[0] ?? ''
    expect(footer).toContain('사업자등록번호 259-23-02007')
    expect(footer).not.toContain('담당자')
    expect(footer).not.toContain('통신판매업신고')
  })

  it('모르는 필드가 섞이면 통째로 거부한다', async () => {
    expect((await post('/api/admin/settings', { ...settingsBody(), sealImage: 1 }, 'super')).status).toBe(400)
  })
})

describe('대표자 서명·날인 이미지', () => {
  it('중간관리자는 올리지 못한다', async () => {
    expect((await uploadSeal(RGBA_PNG, 'manager')).status).toBe(403)
  })

  it('알파 채널 없는 PNG 는 거부한다', async () => {
    const res = await uploadSeal(RGB_PNG, 'super')
    expect(res.status).toBe(400)
    expect(await res.json()).toEqual({ error: 'invalid_image' })
  })

  it('투명 PNG 는 받고, 관리자만 미리보기를 볼 수 있다', async () => {
    expect((await uploadSeal(RGBA_PNG, 'super')).status).toBe(200)
    const preview = await api('/api/admin/settings/seal', { headers: auth('manager') })
    expect(preview.status).toBe(200)
    expect(preview.headers.get('content-type')).toBe('image/png')
    expect((await api('/api/admin/settings/seal', { headers: auth('customer') })).status).toBe(403)
    expect((await api('/api/admin/settings/seal')).status).toBe(401)
  })
})

describe('관리자 계정', () => {
  it('계정 생성은 최고관리자만 — 중간관리자 403', async () => {
    const body = { email: `set-new-mgr+${RUN}@ayuta.test`, name: '새 매니저', password: 'LongPass!2026', role: 'manager' }
    expect((await post('/api/admin/accounts', body, 'manager')).status).toBe(403)
    const res = await post('/api/admin/accounts', body, 'super')
    expect(res.status).toBe(200)
    const payload = await localPayload()
    const { docs } = await payload.find({ collection: 'users', where: { email: { equals: body.email } }, overrideAccess: true })
    expect(docs[0]?.role).toBe('manager')
    expect((await login(body.email, body.password)).token).toBeTruthy()
  })

  it('비밀번호 10자 미만은 거부한다', async () => {
    expect((await post('/api/admin/accounts', { email: `set-short+${RUN}@ayuta.test`, name: 'x', password: 'short', role: 'manager' }, 'super')).status).toBe(400)
  })

  it('권한 변경: 자기 자신은 못 바꾸고, 다른 계정은 바꾼다', async () => {
    expect((await post('/api/admin/accounts/role', { userId: userIds[0], role: 'manager' }, 'super')).status).toBe(400)
    expect((await post('/api/admin/accounts/role', { userId: userIds[1], role: 'customer' }, 'super')).status).toBe(200)
    const payload = await localPayload()
    expect((await payload.findByID({ collection: 'users', id: userIds[1]!, overrideAccess: true })).role).toBe('customer')
  })

  it('계정 화면은 중간관리자에게 감춘다(404)', async () => {
    const payload = await localPayload()
    const email = `set-mgr2+${RUN}@ayuta.test`
    const u = await payload.create({ collection: 'users', data: { email, password: PW, ...base, role: 'manager' }, overrideAccess: true, context: { allowRoleAssignment: true } })
    userIds.push(u.id as number)
    const t = (await login(email, PW)).token
    expect((await api('/manage/accounts', { headers: { Authorization: `JWT ${t}` } })).status).toBe(404)
    expect((await api('/manage/accounts', { headers: auth('super') })).status).toBe(200)
  })
})
