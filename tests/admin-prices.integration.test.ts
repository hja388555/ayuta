// 관리자 단가·기간 배수 수정 경로(POST /api/admin/prices, /api/admin/pricing-settings)와
// 단가 관리 화면 게이트를 실제 서버·DB 앞에서 고정한다. 저장한 값이 견적 계산에 바로 쓰이는지,
// 가격을 바꾸는 권한이 2단계 인증을 끝낸 super 에게만 있는지를 본다.
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { calculate } from '@ayuta/pricing'
import { api, login } from './helpers/server.js'
import { localPayload } from './helpers/localApi.js'
import { loadPriceBook } from '../src/lib/price-book'
import { loadCategoryModel } from '../src/lib/pricing-model'
import { CATEGORIES } from '../src/lib/categories'

const RUN = Date.now()
const PW = 'Ayuta!Test-2026'
const base = { name: '홍길동', phone: '010-0000-0000', postalCode: '00000', address1: '서울시' }
const ACCOUNTS = {
  super: { email: `ap-super+${RUN}@ayuta.test`, role: 'super', verified: true },
  manager: { email: `ap-mgr+${RUN}@ayuta.test`, role: 'manager', verified: true },
  unverified: { email: `ap-unverified+${RUN}@ayuta.test`, role: 'super', verified: false },
  customer: { email: `ap-cust+${RUN}@ayuta.test`, role: 'customer', verified: false },
} as const
type Who = keyof typeof ACCOUNTS

const userIds: number[] = []
const otpIds: number[] = []
const tokens: Partial<Record<Who, string>> = {}
let entryId: number
const entryKey = `ap-transit-${RUN}`
let originalMultipliers: Record<string, number>

const post = (path: string, body: unknown, who?: Who) =>
  api(path, {
    method: 'POST',
    headers: who && tokens[who] ? { Authorization: `JWT ${tokens[who]}` } : {},
    body: JSON.stringify(body),
  })

const storedEntry = async () => {
  const payload = await localPayload()
  return payload.findByID({ collection: 'price-entries', id: entryId, overrideAccess: true })
}

beforeAll(async () => {
  const payload = await localPayload()
  for (const [who, acc] of Object.entries(ACCOUNTS) as Array<[Who, (typeof ACCOUNTS)[Who]]>) {
    const u = await payload.create({
      collection: 'users',
      data: { email: acc.email, password: PW, ...base, role: acc.role },
      overrideAccess: true,
      context: { allowRoleAssignment: true },
    })
    userIds.push(u.id as number)
    if (acc.verified) {
      const otp = await payload.create({
        collection: 'admin-otps',
        data: {
          user: u.id as number,
          hash: 'x'.repeat(64),
          salt: 'y'.repeat(32),
          expiresAt: new Date(Date.now() + 10 * 60 * 1000).toISOString(),
          consumedAt: new Date().toISOString(),
          attempts: 1,
        },
        overrideAccess: true,
      })
      otpIds.push(otp.id as number)
    }
    tokens[who] = (await login(acc.email, PW)).token
  }

  const entry = await payload.create({
    collection: 'price-entries',
    overrideAccess: true,
    data: { key: entryKey, labelKo: '배수검증', labelJa: '倍率検証', category: 4, priceKrw: 100_000, priceJpy: 10_000, active: true },
  })
  entryId = entry.id as number

  const settings = await payload.findGlobal({ slug: 'pricing-settings', overrideAccess: true })
  originalMultipliers = { ...(settings.periodMultipliers as Record<string, number>) }
})

afterAll(async () => {
  const payload = await localPayload()
  const errors: string[] = []
  const attempt = async (label: string, fn: () => Promise<unknown>) => {
    try {
      await fn()
    } catch (err) {
      errors.push(`${label}: ${err instanceof Error ? err.message : String(err)}`)
    }
  }
  await attempt('pricing-settings', () =>
    payload.updateGlobal({ slug: 'pricing-settings', overrideAccess: true, data: { periodMultipliers: originalMultipliers } }),
  )
  await attempt('price-entries', () => payload.delete({ collection: 'price-entries', id: entryId, overrideAccess: true }))
  for (const id of otpIds) await attempt(`admin-otps ${id}`, () => payload.delete({ collection: 'admin-otps', id, overrideAccess: true }))
  for (const id of userIds) await attempt(`users ${id}`, () => payload.delete({ collection: 'users', id, overrideAccess: true }))
  if (errors.length > 0) throw new Error(`테스트 데이터 정리 실패:\n${errors.join('\n')}`)
})

describe('POST /api/admin/prices', () => {
  const body = () => ({ id: entryId, priceKrw: 123_000, priceJpy: 12_300, active: true })

  it('게이트: 비로그인 401, 고객 403, OTP 미완료 403 otp_required, manager 403', async () => {
    expect((await post('/api/admin/prices', body())).status).toBe(401)
    expect((await post('/api/admin/prices', body(), 'customer')).status).toBe(403)
    const unverified = await post('/api/admin/prices', body(), 'unverified')
    expect(unverified.status).toBe(403)
    expect(await unverified.json()).toEqual({ error: 'otp_required' })
    const manager = await post('/api/admin/prices', body(), 'manager')
    expect(manager.status).toBe(403)
    expect(await manager.json()).toEqual({ error: 'forbidden' })
    expect((await storedEntry()).priceKrw).toBe(100_000)
  })

  it('super 가 저장하면 다음 견적부터 새 단가로 계산된다', async () => {
    const res = await post('/api/admin/prices', body(), 'super')
    expect(res.status).toBe(200)
    const book = await loadPriceBook(4, 'KRW')
    expect(book.entries[entryKey]?.amount).toBe(123_000)
  })

  it('소수·음수 금액은 400 이고 저장되지 않는다', async () => {
    for (const priceKrw of [1000.5, -1]) {
      const res = await post('/api/admin/prices', { ...body(), priceKrw }, 'super')
      expect(res.status).toBe(400)
    }
    expect((await storedEntry()).priceKrw).toBe(123_000)
  })

  it('판매 중지(active:false)하면 견적 단가표에서 빠진다', async () => {
    const res = await post('/api/admin/prices', { ...body(), active: false }, 'super')
    expect(res.status).toBe(200)
    const book = await loadPriceBook(4, 'KRW')
    expect(book.entries[entryKey]).toBeUndefined()
    await post('/api/admin/prices', body(), 'super')
  })
})

describe('POST /api/admin/pricing-settings', () => {
  const valid = { periodMultipliers: { '1w': 1, '2w': 1.5, '1m': 2.75, '3m': 7 } }

  it('게이트: OTP 미완료 super 와 manager 는 403 이고 값이 바뀌지 않는다', async () => {
    expect((await post('/api/admin/pricing-settings', valid, 'unverified')).status).toBe(403)
    expect((await post('/api/admin/pricing-settings', valid, 'manager')).status).toBe(403)
    const model = await loadCategoryModel(CATEGORIES.find((c) => c.no === 4)!)
    expect(model.kind === 'sumMultiplier' && model.multipliers['2w']).toBe(originalMultipliers['2w'])
  })

  it('super 가 저장하면 다음 견적부터 새 배수로 계산된다', async () => {
    const res = await post('/api/admin/pricing-settings', valid, 'super')
    expect(res.status).toBe(200)
    const model = await loadCategoryModel(CATEGORIES.find((c) => c.no === 4)!)
    const book = await loadPriceBook(4, 'KRW')
    const quote = calculate(model, book, { items: [entryKey], period: '1m' })
    // 123,000 × 2.75 = 338,250
    expect(quote.ok && quote.total).toBe(338_250)
  })

  it('0·음수·소수 셋째 자리·기간 누락은 400 이다', async () => {
    for (const bad of [
      { ...valid.periodMultipliers, '2w': 0 },
      { ...valid.periodMultipliers, '2w': -1 },
      { ...valid.periodMultipliers, '2w': 1.125 },
    ]) {
      const res = await post('/api/admin/pricing-settings', { periodMultipliers: bad }, 'super')
      expect(res.status).toBe(400)
      expect((await res.json()).field).toBe('2w')
    }
    const missing = { '1w': 1, '2w': 1.5, '1m': 2.75 }
    expect((await post('/api/admin/pricing-settings', { periodMultipliers: missing }, 'super')).status).toBe(400)
  })

  it('REST 로 global 을 직접 고치는 길도 OTP 미완료 super 에게는 막혀 있다', async () => {
    const res = await api('/api/globals/pricing-settings', {
      method: 'POST',
      headers: { Authorization: `JWT ${tokens.unverified}` },
      body: JSON.stringify(valid),
    })
    expect(res.status).toBe(403)
  })
})

describe('단가 관리 화면 게이트', () => {
  const page = (who?: Who) => api('/manage/prices?c=4', { headers: who && tokens[who] ? { Authorization: `JWT ${tokens[who]}` } : {} })

  it('비로그인·고객은 404다', async () => {
    expect((await page()).status).toBe(404)
    expect((await page('customer')).status).toBe(404)
  })

  it('manager 는 조회할 수 있지만 저장 버튼이 없다', async () => {
    const res = await page('manager')
    expect(res.status).toBe(200)
    const html = await res.text()
    expect(html).toContain('배수검증')
    expect(html).toContain('조회만')
    expect(html).not.toContain('배수 저장')
  })

  it('super 에게는 기간 배수 저장 버튼이 보인다', async () => {
    const html = await (await page('super')).text()
    expect(html).toContain('광고 기간별 배수')
    expect(html).toContain('배수 저장')
  })
})
