// "1:1 문의"는 기타 광고 문의 폼이 아니라 1:1 채팅을 연다(Q40, 2026-09-12 사용자 요청).
// 상단 메뉴·주문 상세·결제 불가 안내가 /chat 을 가리키는지, 관리자 설정에 비밀번호 변경 카드가 있는지 서버 HTML 로 고정한다.
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
// localApi 를 먼저 — .env 를 읽기 전에 payload config 를 가져오면 "missing secret key"
import { localPayload } from './helpers/localApi.js'
import { api, login } from './helpers/server.js'

const RUN = Date.now()
const PW = 'Ayuta!Test-2026'
const base = { name: '홍길동', phone: '010-0000-0000', postalCode: '00000', address1: '서울시' }
const userIds: number[] = []
let managerToken = ''

beforeAll(async () => {
  const payload = await localPayload()
  const email = `chat-entry-manager+${RUN}@ayuta.test`
  const u = await payload.create({ collection: 'users', data: { email, password: PW, ...base, role: 'manager' }, overrideAccess: true, context: { allowRoleAssignment: true } })
  userIds.push(u.id as number)
  managerToken = (await login(email, PW)).token ?? ''
})

afterAll(async () => {
  const payload = await localPayload()
  for (const id of userIds) await payload.delete({ collection: 'users', id, overrideAccess: true }).catch(() => {})
})

describe('1:1 문의 → 채팅', () => {
  for (const locale of ['ko', 'ja'] as const) {
    it(`${locale} 상단 메뉴의 1:1 문의가 /${locale}/chat 을 가리키고 문의 폼을 가리키지 않는다`, async () => {
      const html = await (await api(`/${locale}`)).text()
      const nav = html.slice(html.indexOf('class="site-nav"'), html.indexOf('</nav>', html.indexOf('class="site-nav"')))
      expect(nav).toContain(`href="/${locale}/chat"`)
      expect(nav).not.toContain(`/${locale}/order/other`)
    })
  }
})

describe('관리자 비밀번호 변경 카드', () => {
  it('중간관리자도 설정 화면에서 비밀번호 변경 카드를 본다', async () => {
    const res = await api('/manage/settings', { headers: { Authorization: `JWT ${managerToken}` } })
    expect(res.status).toBe(200)
    const html = await res.text()
    expect(html).toContain('비밀번호 변경')
    expect(html).toMatch(/autocomplete="current-password"/i)
  })
})
