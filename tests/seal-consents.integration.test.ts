// 큐 Q25 3차를 실제 서버·DB 앞에서 고정한다:
// (1) 주문은 결제 시점 도장을 고정하고, 계약서 화면에 그 도장이 붙는다 — 나중에 도장을 바꿔도 옛 계약서는 그대로
// (2) 계약서 동의 체크박스 문구를 고칠 수 있지만 항목 구성(key·개수·필수)은 못 바꾼다
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
// localApi 를 먼저 — .env 를 읽기 전에 payload config 를 가져오면 "missing secret key"
import { localPayload } from './helpers/localApi.js'
import { BASE, api, login } from './helpers/server.js'
import { createOrder } from '../src/lib/checkout/create-order'
import sharp from 'sharp'

const RUN = Date.now()
const PW = 'Ayuta!Test-2026'
const base = { name: '홍길동', phone: '010-0000-0000', postalCode: '00000', address1: '서울시' }
const userIds: Record<string, number> = {}
const tokens: Record<string, string | undefined> = {}
const orderIds: number[] = []
const auth = (who: string): Record<string, string> => (tokens[who] ? { Authorization: `JWT ${tokens[who]}` } : {})

// RGBA(6) 1×1 PNG. 두 번째 도장은 sharp 로 만든다(다른 픽셀) — 교체가 새 자산이 되는지 보려고
const PNG_A = Uint8Array.from(atob('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=='), (c) => c.charCodeAt(0))
const makePngB = async () =>
  new Uint8Array(await sharp({ create: { width: 2, height: 2, channels: 4, background: { r: 200, g: 0, b: 0, alpha: 0.5 } } }).png().toBuffer())
const uploadSeal = async (bytes: Uint8Array) => {
  const fd = new FormData()
  fd.set('file', new Blob([bytes], { type: 'image/png' }), 'seal.png')
  return fetch(`${BASE}/api/admin/settings/seal`, { method: 'POST', body: fd, headers: auth('super') })
}
const sealIdNow = async () => {
  const payload = await localPayload()
  const row = await payload.findGlobal({ slug: 'company-settings', depth: 0, overrideAccess: true })
  return (row.sealImage as number | null | undefined) ?? null
}

let originalSeal: number | null = null
let contract: { id: number; consents: Array<{ key: string; label: string; required: boolean }> }

beforeAll(async () => {
  const payload = await localPayload()
  for (const role of ['super', 'customer'] as const) {
    const email = `sc-${role}+${RUN}@ayuta.test`
    const u = await payload.create({ collection: 'users', data: { email, password: PW, ...base, role }, overrideAccess: true, context: { allowRoleAssignment: true } })
    userIds[role] = u.id as number
    tokens[role] = (await login(email, PW)).token
  }
  originalSeal = await sealIdNow()
  const { docs } = await payload.find({ collection: 'contract-templates', where: { and: [{ category: { equals: 1 } }, { locale: { equals: 'ko' } }] }, limit: 1, overrideAccess: true })
  if (!docs[0]) throw new Error('1번 계약서(ko) 시드가 없다 — pnpm seed:contracts 먼저')
  contract = { id: docs[0].id as number, consents: (docs[0].consents as typeof contract.consents).map(({ key, label, required }) => ({ key, label, required })) }
})

afterAll(async () => {
  const payload = await localPayload()
  if (contract) await payload.update({ collection: 'contract-templates', id: contract.id, data: { consents: contract.consents }, overrideAccess: true }).catch(() => {})
  await payload.updateGlobal({ slug: 'company-settings', data: { sealImage: originalSeal }, overrideAccess: true }).catch(() => {})
  for (const id of orderIds) await payload.delete({ collection: 'orders', id, overrideAccess: true }).catch(() => {})
  // 테스트가 올린 도장 자산(원래 도장 제외)과 이력은 치운다
  const { docs: assets } = await payload.find({ collection: 'brand-assets', where: { createdAt: { greater_than: new Date(RUN - 1000).toISOString() } }, limit: 20, overrideAccess: true })
  for (const a of assets) if (a.id !== originalSeal) await payload.delete({ collection: 'brand-assets', id: a.id, overrideAccess: true }).catch(() => {})
  await payload.db.pool.query("DELETE FROM legal_revisions WHERE editor_email LIKE $1", [`%+${RUN}@%`]).catch(() => {})
  await payload.db.pool.query('DELETE FROM admin_login_logs WHERE user_id = ANY($1::int[])', [Object.values(userIds)]).catch(() => {})
  for (const id of Object.values(userIds)) await payload.delete({ collection: 'users', id, overrideAccess: true }).catch(() => {})
})

describe('계약서 서명·날인', () => {
  it('주문은 결제 시점 도장을 고정하고, 도장을 바꿔도 옛 주문은 그대로다', async () => {
    expect((await uploadSeal(PNG_A)).status).toBe(200)
    const sealA = await sealIdNow()
    expect(sealA).not.toBeNull()

    const r = await createOrder({
      categorySlug: 'digital-sns',
      locale: 'ko',
      selection: { tiers: ['standard'], platforms: [], country: ['kr'] },
      consents: { agree: true },
      orderer: { name: `도장고객${RUN}`, phone: '010-1234-5678', email: `sc-order+${RUN}@example.com`, postalCode: '12345', address1: '서울' },
      signature: `도장고객${RUN}`,
    })
    expect(r.ok).toBe(true)
    if (!r.ok) return
    orderIds.push(r.orderId)
    const payload = await localPayload()
    expect((await payload.findByID({ collection: 'orders', id: r.orderId, depth: 0, overrideAccess: true })).sealAsset).toBe(sealA)

    // 도장 교체 — 설정은 새 자산을 가리키지만 주문의 도장은 그대로다
    expect((await uploadSeal(await makePngB())).status).toBe(200)
    expect(await sealIdNow()).not.toBe(sealA)
    expect((await payload.findByID({ collection: 'orders', id: r.orderId, depth: 0, overrideAccess: true })).sealAsset).toBe(sealA)

    // 보관함 화면(본인·결제 완료)에 결제 시점 도장이 data URI 로 붙는다 — 공개 이미지 주소가 없다
    await payload.db.pool.query("UPDATE orders SET customer_id = $1, status = 'paid' WHERE id = $2", [userIds.customer, r.orderId])
    const html = await (await api('/ko/mypage/contracts', { headers: auth('customer') })).text()
    const src = html.match(/data-contract-seal="" src="(data:image\/png;base64,[^"]+)"/)?.[1]
    expect(src).toBeDefined()
    expect(src).toBe(`data:image/png;base64,${Buffer.from(PNG_A).toString('base64')}`)
  })

  it('고객은 도장 자산을 REST 로 직접 읽을 수 없다', async () => {
    const res = await api('/api/brand-assets', { headers: auth('customer') })
    const json = await res.json()
    expect(res.status === 403 || (Array.isArray(json.docs) && json.docs.length === 0)).toBe(true)
  })
})

describe('동의 체크박스 문구', () => {
  const save = (consents: unknown) =>
    api('/api/admin/legal', {
      method: 'POST',
      headers: auth('super'),
      body: JSON.stringify({ target: 'contract', id: contract.id, title: '디지털 / SNS·커뮤니티 광고 서비스 계약서', body: '금액 {{amount}}', consents }),
    })

  it('문구만 바뀌고 key·필수 여부는 유지되며 이력에 남는다', async () => {
    // 본문·제목은 afterAll 이 되돌리지 않으므로 원래 값을 먼저 읽어 그대로 보낸다
    const payload = await localPayload()
    const before = await payload.findByID({ collection: 'contract-templates', id: contract.id, overrideAccess: true })
    const label = `동의 문구 ${RUN}`
    const res = await api('/api/admin/legal', {
      method: 'POST',
      headers: auth('super'),
      body: JSON.stringify({ target: 'contract', id: contract.id, title: before.title, body: before.body, consents: contract.consents.map((c, i) => ({ key: c.key, label: i === 0 ? label : c.label })) }),
    })
    expect(res.status).toBe(200)
    const after = await payload.findByID({ collection: 'contract-templates', id: contract.id, overrideAccess: true })
    const consents = after.consents as typeof contract.consents
    expect(consents[0]).toMatchObject({ key: contract.consents[0]!.key, label, required: contract.consents[0]!.required })
    expect(consents).toHaveLength(contract.consents.length)
    const { docs } = await payload.find({ collection: 'legal-revisions', where: { and: [{ target: { equals: 'contract-templates' } }, { docId: { equals: contract.id } }] }, sort: '-at', limit: 1, overrideAccess: true })
    expect(JSON.stringify(docs[0]?.consents)).toContain(label)
  })

  it('항목 key 가 다르거나 개수가 다르면 거절한다', async () => {
    const renamed = contract.consents.map((c) => ({ key: `${c.key}-x`, label: c.label }))
    const res = await save(renamed)
    expect(res.status).toBe(400)
    expect((await res.json()).error).toBe('consent_keys_mismatch')
    expect((await save([...contract.consents.map(({ key, label }) => ({ key, label })), { key: 'extra', label: '추가' }])).status).toBe(400)
  })

  it('required 를 보내도 받지 않는다(구조 변경 차단)', async () => {
    const res = await save(contract.consents.map(({ key, label }) => ({ key, label, required: false })))
    expect(res.status).toBe(400)
  })
})
