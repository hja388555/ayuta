// 단가 금액 검증(validateMinorAmount)이 REST 입력 앞에서도 성립하는지 고정한다.
// 단위 테스트는 number 를 직접 넘기지만, 실제 관리자 요청은 JSON 이라 문자열("1000.5")·
// 지수표기("1e3")·빈 문자열이 들어올 수 있다. Payload 가 이 값을 validate 전에 숫자로
// 바꾸는지 후에 바꾸는지에 따라 소수가 정수 검증을 빠져나갈 수 있다 — 그래서 결과를 본다:
// 거부된 값은 DB 가 그대로여야 하고, 받아들여진 값은 반드시 정확한 정수로 저장돼야 한다.
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { api, login } from './helpers/server.js'
import { localPayload } from './helpers/localApi.js'

const RUN = Date.now()
const SUPER = { email: `price-super+${RUN}@ayuta.test`, password: 'Ayuta!Test-2026' }
const base = { name: '홍길동', phone: '010-0000-0000', postalCode: '00000', address1: '서울시' }
const ORIGINAL = 1000

let userId: number
let entryId: number
let token: string | undefined

const patch = (body: unknown) =>
  api(`/api/price-entries/${entryId}`, {
    method: 'PATCH',
    headers: { Authorization: `JWT ${token}` },
    body: JSON.stringify(body),
  })

const storedKrw = async () => {
  const payload = await localPayload()
  const doc = await payload.findByID({ collection: 'price-entries', id: entryId, overrideAccess: true })
  return doc.priceKrw as unknown
}

const reset = async () => {
  const payload = await localPayload()
  await payload.update({ collection: 'price-entries', id: entryId, data: { priceKrw: ORIGINAL }, overrideAccess: true })
}

beforeAll(async () => {
  const payload = await localPayload()
  const user = await payload.create({
    collection: 'users',
    data: { ...SUPER, ...base, role: 'super' },
    overrideAccess: true,
    context: { allowRoleAssignment: true },
  })
  userId = user.id as number
  const entry = await payload.create({
    collection: 'price-entries',
    overrideAccess: true,
    // 카테고리 5는 다른 통합 테스트가 손상 행을 심지 않는 곳이다
    data: { key: `rest-amount-${RUN}`, labelKo: '검증용', labelJa: '検証', category: 5, priceKrw: ORIGINAL, priceJpy: 100, active: false },
  })
  entryId = entry.id as number
  token = (await login(SUPER.email, SUPER.password)).token
  expect(token).toBeTruthy()
})

afterAll(async () => {
  const payload = await localPayload()
  const errors: string[] = []
  for (const [collection, id] of [
    ['price-entries', entryId],
    ['users', userId],
  ] as const) {
    try {
      await payload.delete({ collection, id, overrideAccess: true })
    } catch (err) {
      errors.push(`${collection} id=${id}: ${err instanceof Error ? err.message : String(err)}`)
    }
  }
  if (errors.length > 0) throw new Error(`테스트 데이터 정리 실패:\n${errors.join('\n')}`)
})

describe('PATCH /api/price-entries/:id — 소수·음수·숫자 아닌 값은 저장되지 않는다', () => {
  const rejected: Array<[string, unknown]> = [
    ['소수 number', 1000.5],
    ['소수 문자열', '1000.5'],
    ['지수표기 소수 문자열', '1.0005e3'],
    ['작은 지수표기 문자열', '1e-3'],
    ['음수 number', -1],
    ['음수 문자열', '-1'],
    ['숫자 아닌 문자열', 'abc'],
    ['빈 문자열', ''],
    ['NaN 문자열', 'NaN'],
    ['Infinity 문자열', 'Infinity'],
  ]

  for (const [label, value] of rejected) {
    it(`${label} (${JSON.stringify(value)}) 는 400 이고 기존 금액이 유지된다`, async () => {
      const res = await patch({ priceKrw: value })
      expect(res.status).toBe(400)
      expect(await storedKrw()).toBe(ORIGINAL)
    })
  }
})

describe('정수로 해석되는 값은 정확한 정수로만 저장된다', () => {
  // 문자열 정수·지수표기 정수를 받아들이는지는 Payload 변환 규칙에 달렸다. 받아들인다면
  // 저장값이 반드시 그 정수여야 하고, 거부한다면 기존 값이 그대로여야 한다 — 어느 쪽이든
  // 소수가 섞여 들어가는 결과만 없으면 된다.
  for (const [value, expected] of [
    [2000, 2000],
    ['2000', 2000],
    ['2e3', 2000],
    [2e3, 2000],
  ] as const) {
    it(`${JSON.stringify(value)} → 저장되면 ${expected}, 아니면 거부`, async () => {
      await reset()
      const res = await patch({ priceKrw: value })
      const stored = await storedKrw()
      if (res.status === 200) {
        expect(stored).toBe(expected)
        expect(Number.isInteger(stored)).toBe(true)
      } else {
        expect(res.status).toBe(400)
        expect(stored).toBe(ORIGINAL)
      }
    })
  }

  it('number 정수 2000 은 반드시 받아들인다 (회귀 방지)', async () => {
    await reset()
    const res = await patch({ priceKrw: 2000 })
    expect(res.status).toBe(200)
    expect(await storedKrw()).toBe(2000)
  })
})
