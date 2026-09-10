// 계약서 보관함(큐 Q21-B)을 실제 서버·DB 앞에서 고정한다. 본인 주문의 "결제한" 계약서만
// 보이는지, 남의 계약서·결제 전 초안이 섞이지 않는지, 비회원도 인증 후 같은 팝업을 받는지 본다.
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { api, login } from './helpers/server.js'
import { localPayload } from './helpers/localApi.js'

const RUN = Date.now()
const PW = 'Ayuta!Test-2026'
const base = { name: '홍길동', phone: '010-0000-0000', postalCode: '00000', address1: '서울시' }
const ME = { email: `ca-me+${RUN}@ayuta.test` }
const OTHER = { email: `ca-other+${RUN}@ayuta.test` }

const userIds: Record<string, number> = {}
const orderIds: number[] = []
const text = (tag: string) => `계약서원문-${tag}-${RUN}`
let token: string | undefined

const makeOrder = async (tag: string, status: string, customer: number | null, orderer = { email: 'x@example.com', phone: '010-1111-1111' }) => {
  const payload = await localPayload()
  const o = await payload.create({
    collection: 'orders',
    overrideAccess: true,
    data: {
      orderNumber: `AY-CA-${RUN}-${tag}`,
      paymentId: `pay-ca-${RUN}-${tag}`,
      status: status as 'paid',
      currency: 'KRW',
      amount: 100_000,
      locale: 'ko',
      category: 3,
      customer,
      items: [{ code: 'blog-note', label: 'note', unitAmount: 100_000, quantity: 1 }],
      contractItems: [{ label: '블로그', value: 'note' }],
      orderer: { name: '주문자', phone: orderer.phone, email: orderer.email, postcode: '12345', address1: '서울' },
      signature: '주문자',
      contractText: text(tag),
    },
  })
  orderIds.push(o.id as number)
  return o
}

beforeAll(async () => {
  const payload = await localPayload()
  for (const [name, creds] of [
    ['me', ME],
    ['other', OTHER],
  ] as const) {
    const u = await payload.create({ collection: 'users', data: { ...creds, password: PW, ...base, role: 'customer' }, overrideAccess: true })
    userIds[name] = u.id as number
  }
  await makeOrder('paid', 'paid', userIds.me!)
  await makeOrder('done', 'done', userIds.me!)
  await makeOrder('cancelled', 'cancelled', userIds.me!)
  await makeOrder('pending', 'pending', userIds.me!)
  await makeOrder('failed', 'failed', userIds.me!)
  await makeOrder('others', 'paid', userIds.other!)
  token = (await login(ME.email, PW)).token
})

afterAll(async () => {
  const payload = await localPayload()
  for (const id of orderIds) await payload.delete({ collection: 'orders', id, overrideAccess: true }).catch(() => {})
  for (const id of Object.values(userIds)) await payload.delete({ collection: 'users', id, overrideAccess: true }).catch(() => {})
})

describe('계약서 보관함', () => {
  it('비로그인은 로그인 화면으로 보낸다', async () => {
    const res = await api('/ko/mypage/contracts', { redirect: 'manual' })
    expect([303, 307, 308]).toContain(res.status)
    expect(res.headers.get('location')).toContain('/ko/login')
  })

  it('결제한 내 계약서(결제완료·완료·취소)만 보이고, 결제 전 초안과 남의 계약서는 없다', async () => {
    const html = await (await api('/ko/mypage/contracts', { headers: { Authorization: `JWT ${token}` } })).text()
    expect(html).toContain(text('paid'))
    expect(html).toContain(text('done'))
    expect(html).toContain(text('cancelled'))
    expect(html).not.toContain(text('pending'))
    expect(html).not.toContain(text('failed'))
    expect(html).not.toContain(text('others'))
    expect(html).toContain('계약서 보기')
    // 계약기간은 스냅샷에 없어 따로 합쳐 보여준다 — 아직 안 정해졌으면 "협의 중"
    expect(html).toContain('협의 중')
  })

  it('마이페이지에서 보관함으로 가는 메뉴가 있다', async () => {
    const html = await (await api('/ko/mypage', { headers: { Authorization: `JWT ${token}` } })).text()
    expect(html).toContain('/ko/mypage/contracts')
  })
})

describe('비회원 — 주문 조회 인증 후 같은 팝업', () => {
  it('세 값이 맞으면 주문 화면에서 계약서 팝업 내용을 받는다', async () => {
    const guest = { email: `ca-guest+${RUN}@example.com`, phone: '010-4444-5555' }
    const o = await makeOrder('guest', 'paid', null, guest)
    const lookup = await api('/api/order-lookup', { method: 'POST', body: JSON.stringify({ orderNumber: o.orderNumber, ...guest }) })
    const { path } = await lookup.json()
    const cookie = (lookup.headers.get('set-cookie') ?? '').split(';')[0]!
    const html = await (await api(path, { headers: { Cookie: cookie } })).text()
    expect(html).toContain(text('guest'))
    expect(html).toContain('<dialog')
  })
})
