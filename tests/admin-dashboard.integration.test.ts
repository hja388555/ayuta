// 관리자 셸·대시보드(Figma [v2] A2): 관리자 두 등급은 대시보드를 보고, 고객은 404,
// 최고관리자 전용 메뉴(관리자 계정)는 중간관리자 셸에 나오지 않는다.
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { localPayload } from './helpers/localApi.js'
import { api, login } from './helpers/server.js'

const RUN = Date.now()
const PW = 'Ayuta!Test-2026'
const base = { name: '홍길동', phone: '010-0000-0000', postalCode: '00000', address1: '서울시' }
const userIds: number[] = []
const tokens: Record<string, string | undefined> = {}
const page = (who?: string) => api('/manage', { headers: who && tokens[who] ? { Authorization: `JWT ${tokens[who]}` } : {} })

beforeAll(async () => {
  const payload = await localPayload()
  for (const role of ['super', 'manager', 'customer'] as const) {
    const email = `dash-${role}+${RUN}@ayuta.test`
    const u = await payload.create({ collection: 'users', data: { email, password: PW, ...base, role }, overrideAccess: true, context: { allowRoleAssignment: true } })
    userIds.push(u.id as number)
    tokens[role] = (await login(email, PW)).token
  }
})

afterAll(async () => {
  const payload = await localPayload()
  await payload.db.pool.query('DELETE FROM admin_login_logs WHERE user_id = ANY($1::int[])', [userIds]).catch(() => {})
  for (const id of userIds) await payload.delete({ collection: 'users', id, overrideAccess: true }).catch(() => {})
})

describe('관리자 대시보드', () => {
  it('비로그인·고객은 404', async () => {
    expect((await page()).status).toBe(404)
    expect((await page('customer')).status).toBe(404)
  })

  it.each(['super', 'manager'])('%s 는 셸과 KPI 를 본다', async (who) => {
    const res = await page(who)
    expect(res.status).toBe(200)
    const html = await res.text()
    for (const s of ['AYUTA 관리자', '로그아웃', '대시보드', '오늘 주문', '접수 대기', '환불 신청', '이번 달 매출', '최근 주문']) expect(html).toContain(s)
    expect(html).toContain('href="/manage/orders"')
  })

  it('관리자 계정 메뉴는 최고관리자에게만', async () => {
    expect(await (await page('super')).text()).toContain('href="/manage/accounts"')
    expect(await (await page('manager')).text()).not.toContain('href="/manage/accounts"')
  })
})
